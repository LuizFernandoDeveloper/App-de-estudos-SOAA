use std::{collections::HashMap, path::Path, sync::Mutex};

use rusqlite::{params, params_from_iter, Connection, Result as SqlResult, Row};

use crate::scheduler::{
    calculate_retrievability, days_since, difficulty_scale, due_date_iso, grade_label,
    grade_multiplier, parse_date, today_iso,
};

use crate::models::{
    BrainDumpLog, BrainDumpLogInput, BufferAllocation, ConsolidatedPerformanceReport,
    ConsolidatedPerformanceRow, ConsolidatedPerformanceTotals, DailyPerformance, DashboardData,
    DayAllocation, DayAllocationInput, FocusOverloadPoint, FocusSession, FocusSessionInput,
    FocusZone, FsrsReview, LearningSpeed, MaterialInput, MaterialProgress, MaterialReminder,
    MaterialStrategy, MemoryDecayProjection, MemoryPoint, PerformanceLiveStream,
    PerformanceLiveTick, PerformancePoint, PlanDay, PlanFocus,
    PlanInput, PlanResponse, Profile, ProfileInput, QuestionProgress, QuestionResult,
    QuestionResultInput, RescheduleItem, ReschedulePlan, RetentionCurve, RetentionCurvePoint,
    RetentionOverview, RetentionSeriesInfo, SessionSummary, SpacedRepetitionItem, StrategyMatch,
    StudyMaterial, Subject, SubjectAccuracyPoint, SubjectPerformance, SubjectRanking,
    TimeboxSuggestion, Topic,
};

pub const DEFAULT_USER_ID: i64 = 1;

pub struct AppState {
    pub connection: Mutex<Connection>,
}

impl AppState {
    pub fn new(path: &Path) -> SqlResult<Self> {
        let mut connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.execute_batch(SCHEMA)?;
        migrate(&connection)?;
        seed(&mut connection)?;
        Ok(Self { connection: Mutex::new(connection) })
    }
}

/// Executa uma sequência de gravações dentro de UMA transação SQL.
///
/// Se a closure falhar, a transação é descartada sem commit e toda escrita parcial
/// é revertida (rollback) pelo SQLite — nenhum registro sujo sobrevive. Todo caminho
/// de escrita do banco passa por aqui.
pub fn run_write<T>(
    connection: &mut Connection,
    operation: impl FnOnce(&Connection) -> SqlResult<T>,
) -> SqlResult<T> {
    let transaction = connection.transaction()?;
    let result = operation(&transaction);
    match result {
        Ok(value) => {
            transaction.commit()?;
            Ok(value)
        }
        Err(error) => Err(error),
    }
}

/// Migra bancos criados antes da separação `focus_sessions`/`fsrs_reviews`:
/// renomeia as tabelas legadas (`pomodoro_sessions` → `focus_sessions` e
/// `review_logs` → `fsrs_reviews`) e garante a coluna de zona de foco.
///
/// Importante: a ordem de execução é `SCHEMA` (cria as tabelas novas, vazias)
/// seguido de `migrate`. Quando a base legada existe, descartamos a cópia vazia
/// recém-criada e renomeamos a antiga — movendo dados, FKs e o índice que referenciam
/// o nome antigo são ajustados pelo próprio ALTER TABLE RENAME do SQLite.
fn migrate_focus_and_review_tables(connection: &Connection) -> SqlResult<()> {
    let table_exists = |name: &str| -> SqlResult<bool> {
        connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                params![name],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
    };

    if table_exists("pomodoro_sessions")? {
        connection.execute_batch(
            "DROP TABLE IF EXISTS focus_sessions;
             ALTER TABLE pomodoro_sessions RENAME TO focus_sessions;
             DROP INDEX IF EXISTS idx_pomodoro_subject_started;",
        )?;
    }
    if table_exists("review_logs")? {
        connection.execute_batch(
            "DROP TABLE IF EXISTS fsrs_reviews;
             ALTER TABLE review_logs RENAME TO fsrs_reviews;
             DROP INDEX IF EXISTS idx_review_logs_item;",
        )?;
    }

    let focus_columns: Vec<String> = connection
        .prepare("PRAGMA table_info(focus_sessions)")?
        .query_map([], |row| row.get(1))?
        .collect::<SqlResult<Vec<_>>>()?;
    if !focus_columns.iter().any(|column| column == "zone") {
        connection.execute_batch(
            "ALTER TABLE focus_sessions ADD COLUMN zone TEXT NOT NULL DEFAULT 'baixa' CHECK(zone IN ('alta', 'media', 'baixa'));",
        )?;
    }
    connection.execute_batch(
        "UPDATE focus_sessions
         SET zone = CASE
           WHEN completion_rate >= 1.0 THEN 'baixa'
           WHEN completion_rate >= 0.6 THEN 'media'
           ELSE 'alta'
         END;",
    )?;

    Ok(())
}

fn migrate(connection: &Connection) -> SqlResult<()> {
    migrate_focus_and_review_tables(connection)?;

    let material_columns: Vec<String> = connection
        .prepare("PRAGMA table_info(study_materials)")?
        .query_map([], |row| row.get(1))?
        .collect::<SqlResult<Vec<_>>>()?;
    for (column, ddl) in [
        ("front", "ALTER TABLE study_materials ADD COLUMN front TEXT"),
        ("topic", "ALTER TABLE study_materials ADD COLUMN topic TEXT"),
        ("page_focus", "ALTER TABLE study_materials ADD COLUMN page_focus TEXT"),
        ("remind_date", "ALTER TABLE study_materials ADD COLUMN remind_date TEXT"),
        ("topic_id", "ALTER TABLE study_materials ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL"),
        ("current_page", "ALTER TABLE study_materials ADD COLUMN current_page INTEGER NOT NULL DEFAULT 0"),
        ("total_pages", "ALTER TABLE study_materials ADD COLUMN total_pages INTEGER NOT NULL DEFAULT 0"),
        ("study_strategy", "ALTER TABLE study_materials ADD COLUMN study_strategy TEXT"),
    ] {
        if !material_columns.iter().any(|existing| existing == column) {
            connection.execute_batch(ddl)?;
        }
    }

    let subject_columns: Vec<String> = connection
        .prepare("PRAGMA table_info(subjects)")?
        .query_map([], |row| row.get(1))?
        .collect::<SqlResult<Vec<_>>>()?;
    for (column, ddl) in [
        ("goal_accuracy", "ALTER TABLE subjects ADD COLUMN goal_accuracy INTEGER NOT NULL DEFAULT 75"),
        ("goal_coverage", "ALTER TABLE subjects ADD COLUMN goal_coverage INTEGER NOT NULL DEFAULT 100"),
        ("current_level", "ALTER TABLE subjects ADD COLUMN current_level INTEGER NOT NULL DEFAULT 1"),
        ("target_level", "ALTER TABLE subjects ADD COLUMN target_level INTEGER NOT NULL DEFAULT 5"),
    ] {
        if !subject_columns.iter().any(|existing| existing == column) {
            connection.execute_batch(ddl)?;
        }
    }

    let settings_columns: Vec<String> = connection
        .prepare("PRAGMA table_info(user_settings)")?
        .query_map([], |row| row.get(1))?
        .collect::<SqlResult<Vec<_>>>()?;
    for (column, ddl) in [
        ("start_date", "ALTER TABLE user_settings ADD COLUMN start_date TEXT"),
        ("exam_date", "ALTER TABLE user_settings ADD COLUMN exam_date TEXT"),
        ("study_days", "ALTER TABLE user_settings ADD COLUMN study_days TEXT"),
    ] {
        if !settings_columns.iter().any(|existing| existing == column) {
            connection.execute_batch(ddl)?;
        }
    }

    let focus_columns_legacy: Vec<String> = connection
        .prepare("PRAGMA table_info(focus_sessions)")?
        .query_map([], |row| row.get(1))?
        .collect::<SqlResult<Vec<_>>>()?;
    for (column, ddl) in [
        ("status", "ALTER TABLE focus_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'done' CHECK(status IN ('pending', 'partial', 'done', 'buffered'))"),
        ("completion_percentage", "ALTER TABLE focus_sessions ADD COLUMN completion_percentage REAL"),
    ] {
        if !focus_columns_legacy.iter().any(|existing| existing == column) {
            connection.execute_batch(ddl)?;
        }
    }

    let srs_columns: Vec<String> = connection
        .prepare("PRAGMA table_info(spaced_repetition_items)")?
        .query_map([], |row| row.get(1))?
        .collect::<SqlResult<Vec<_>>>()?;
    for (column, ddl) in [
        ("topic_id", "ALTER TABLE spaced_repetition_items ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL"),
    ] {
        if !srs_columns.iter().any(|existing| existing == column) {
            connection.execute_batch(ddl)?;
        }
    }

    let question_result_columns: Vec<String> = connection
        .prepare("PRAGMA table_info(question_results)")?
        .query_map([], |row| row.get(1))?
        .collect::<SqlResult<Vec<_>>>()?;
    for (column, ddl) in [
        ("topic_id", "ALTER TABLE question_results ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL"),
    ] {
        if !question_result_columns.iter().any(|existing| existing == column) {
            connection.execute_batch(ddl)?;
        }
    }

    // Recria os índices com nome atual (idempotente). Necessário após a renomeação
    // de tabelas legadas, que descarta os índices criados pelo SCHEMA na tabela vazia.
    connection.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_focus_subject_started ON focus_sessions(subject_id, started_at);
         CREATE INDEX IF NOT EXISTS idx_fsrs_reviews_item ON fsrs_reviews(item_id, reviewed_at);",
    )?;

    Ok(())
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_hours REAL NOT NULL DEFAULT 6 CHECK (daily_hours > 0 AND daily_hours <= 24),
  weekly_days INTEGER NOT NULL DEFAULT 6 CHECK (weekly_days BETWEEN 1 AND 7),
  exam_track TEXT NOT NULL DEFAULT 'ITA',
  start_date TEXT,
  exam_date TEXT,
  study_days TEXT
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 5),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  computed_ip INTEGER GENERATED ALWAYS AS (weight * difficulty) STORED,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  url_path TEXT,
  status TEXT NOT NULL CHECK(status IN ('pendente', 'em_andamento', 'concluido')) DEFAULT 'pendente',
  tags_json TEXT NOT NULL DEFAULT '[]',
  front TEXT,
  topic TEXT,
  page_focus TEXT,
  remind_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_hours_available REAL NOT NULL,
  allocated_data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS question_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  questions_total INTEGER NOT NULL CHECK(questions_total > 0),
  questions_correct INTEGER NOT NULL CHECK(questions_correct >= 0 AND questions_correct <= questions_total),
  studied_minutes INTEGER NOT NULL DEFAULT 0 CHECK(studied_minutes >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pendente', 'em_andamento', 'concluido')) DEFAULT 'pendente',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, subject_id, name)
);

CREATE TABLE IF NOT EXISTS day_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  minutes INTEGER NOT NULL DEFAULT 60 CHECK (minutes > 0 AND minutes <= 600),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL,
  goal_type TEXT NOT NULL CHECK(goal_type IN ('paginas', 'topicos', 'exercicios')),
  goal_text TEXT,
  page_start INTEGER,
  page_end INTEGER,
  planned_minutes INTEGER NOT NULL CHECK(planned_minutes > 0),
  elapsed_minutes INTEGER NOT NULL DEFAULT 0 CHECK(elapsed_minutes >= 0),
  planning_minutes INTEGER NOT NULL DEFAULT 0,
  interrupts INTEGER NOT NULL DEFAULT 0 CHECK(interrupts >= 0),
  completion_rate REAL NOT NULL DEFAULT 0 CHECK(completion_rate >= 0 AND completion_rate <= 1),
  zone TEXT NOT NULL DEFAULT 'baixa' CHECK(zone IN ('alta', 'media', 'baixa')),
  exit_reason TEXT CHECK(exit_reason IN ('fadiga_metabolica', 'distracao_externa', 'dificuldade_materia', 'meta_concluida') OR exit_reason IS NULL),
  completed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'done' CHECK(status IN ('pending', 'partial', 'done', 'buffered')),
  completion_percentage REAL CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brain_dump_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buffer_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  source_session_id INTEGER REFERENCES focus_sessions(id) ON DELETE SET NULL,
  debt_minutes INTEGER NOT NULL CHECK(debt_minutes > 0),
  destination TEXT NOT NULL CHECK(destination IN ('saturday', 'next_week')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'done', 'expired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keywords TEXT NOT NULL UNIQUE,
  tactic TEXT NOT NULL,
  reason TEXT NOT NULL,
  intensity TEXT NOT NULL DEFAULT 'alta'
);

CREATE TABLE IF NOT EXISTS spaced_repetition_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  concept TEXT NOT NULL,
  difficulty REAL NOT NULL DEFAULT 5 CHECK (difficulty >= 1 AND difficulty <= 10),
  stability REAL NOT NULL DEFAULT 1 CHECK (stability > 0),
  reps INTEGER NOT NULL DEFAULT 0 CHECK (reps >= 0),
  last_review_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fsrs_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES spaced_repetition_items(id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK(grade IN ('again', 'hard', 'good', 'easy')),
  stability_before REAL NOT NULL CHECK (stability_before > 0),
  stability_after REAL NOT NULL CHECK (stability_after > 0),
  retrievability REAL NOT NULL CHECK (retrievability >= 0 AND retrievability <= 1),
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_user ON study_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_user_date ON question_results(user_id, date);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_focus_subject_started ON focus_sessions(subject_id, started_at);
CREATE INDEX IF NOT EXISTS idx_day_allocations_user ON day_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_srs_items_user ON spaced_repetition_items(user_id);
CREATE INDEX IF NOT EXISTS idx_fsrs_reviews_item ON fsrs_reviews(item_id, reviewed_at);
"#;

fn seed(connection: &mut Connection) -> SqlResult<()> {
    connection.execute(
        "INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?1, ?2, NULL)",
        params![DEFAULT_USER_ID, "local@soaa.app"],
    )?;
    connection.execute(
        "INSERT OR IGNORE INTO user_settings (user_id, daily_hours, weekly_days, exam_track) VALUES (?1, 6, 6, 'ITA')",
        params![DEFAULT_USER_ID],
    )?;

    const STRATEGY_SEED: &[(&str, &str, &str, &str)] = &[
        ("fundamentos, matemática, elementar", "Prática de Recuperação prioritária", "Livros clássicos de base exigem recuperação ativa pós-leitura: consolida a lógica, não leitura passiva.", "alta"),
        ("exercícios, lista", "Intercalação por blocos", "Alternar tópicos dentro da lista força a discriminação de padrões e evita o efeito de 'saber por repetição'.", "alta"),
        ("problemas, física", "Resolução em Deep Work", "Problemas abertos exigem contexto mental descarregado; não interrompa no meio da sessão.", "alta"),
        ("gramática, língua", "Spaced Repetition + lembrete", "Regras linguísticas têm alta retrievability inicial; o lembrete de revisão reforça a curva FSRS.", "media"),
        ("redação, dissertação", "Prática deliberada com feedback", "Uma redação sem correção orientada não gera adaptação neural; priorize o retorno.", "media"),
        ("vocabulário, reading", "Leitura intercalada com recuperação", "Input em contexto precisa de recuperação ativa (produção) para virar memória de longo prazo.", "media"),
        ("citologia, genética, biologia", "Mapa mental + prática espaçada", "Carga declarativa alta: distribuir por dias evita saturação e aumenta Stability.", "media"),
        ("atualidades, humanas", "Blocos curtos de manhã", "Humanas consolidam melhor no aquecimento matinal, quando a retenção pós-sono é maior.", "baixa"),
        ("química", "Revisão de erros + prática", "Estequiometria/termoquímica exigem automatização; catalogue o erro de cada questão.", "media"),
    ];
    for (keywords, tactic, reason, intensity) in STRATEGY_SEED {
        connection.execute(
            "INSERT OR IGNORE INTO material_strategies (keywords, tactic, reason, intensity) VALUES (?1, ?2, ?3, ?4)",
            params![keywords, tactic, reason, intensity],
        )?;
    }

    let pending: Vec<(i64, String, String)> = connection
        .prepare("SELECT id, title, category FROM study_materials WHERE user_id = ?1 AND (study_strategy IS NULL OR study_strategy = '')")?
        .query_map(params![DEFAULT_USER_ID], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
        .collect::<SqlResult<Vec<_>>>()?;
    for (id, title, category) in pending {
        if let Some(suggestion) = match_strategy(connection, &title, &category)? {
            connection.execute(
                "UPDATE study_materials SET study_strategy = ?1 WHERE id = ?2",
                params![suggestion.tactic, id],
            )?;
        }
    }

    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM subjects WHERE user_id = ?1",
        params![DEFAULT_USER_ID],
        |row| row.get(0),
    )?;
    if count > 0 {
        return Ok(());
    }

    let initial_subjects = [
        ("Matemática · ITA/IME", 5, 5, "indigo"),
        ("Física · Mecânica e Eletromagnetismo", 5, 4, "violet"),
        ("Química · Físico-Química", 4, 4, "cyan"),
        ("Português e Redação", 4, 3, "pink"),
        ("Inglês · Reading", 3, 2, "amber"),
        ("Biologia", 3, 3, "emerald"),
        ("Humanas · ENEM", 2, 3, "orange"),
    ];
    let transaction = connection.transaction()?;
    for (name, weight, difficulty, color) in initial_subjects {
        transaction.execute(
            "INSERT INTO subjects (user_id, name, weight, difficulty, color) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![DEFAULT_USER_ID, name, weight, difficulty, color],
        )?;
    }
    transaction.commit()
}

fn subject_from_row(row: &Row<'_>) -> SqlResult<Subject> {
    Ok(Subject {
        id: row.get("id")?,
        user_id: row.get("user_id")?,
        name: row.get("name")?,
        weight: row.get("weight")?,
        difficulty: row.get("difficulty")?,
        computed_ip: row.get("computed_ip")?,
        color: row.get("color")?,
        goal_accuracy: row.get("goal_accuracy")?,
        goal_coverage: row.get("goal_coverage")?,
        current_level: row.get("current_level")?,
        target_level: row.get("target_level")?,
        created_at: row.get("created_at")?,
    })
}

const SUBJECT_COLUMNS: &str = "id, user_id, name, weight, difficulty, computed_ip, color, goal_accuracy, goal_coverage, current_level, target_level, created_at";

pub fn list_subjects(connection: &Connection) -> SqlResult<Vec<Subject>> {
    let mut statement = connection.prepare(
        "SELECT id, user_id, name, weight, difficulty, computed_ip, color, goal_accuracy, goal_coverage, current_level, target_level, created_at
         FROM subjects WHERE user_id = ?1 ORDER BY computed_ip DESC, name COLLATE NOCASE",
    )?;
    statement
        .query_map(params![DEFAULT_USER_ID], subject_from_row)?
        .collect()
}

pub fn subject_by_id(connection: &Connection, id: i64) -> SqlResult<Subject> {
    connection.query_row(
        &format!("SELECT {SUBJECT_COLUMNS} FROM subjects WHERE id = ?1 AND user_id = ?2"),
        params![id, DEFAULT_USER_ID],
        subject_from_row,
    )
}

pub fn insert_subject(
    connection: &mut Connection,
    name: &str,
    weight: i64,
    difficulty: i64,
    color: &str,
    current_level: i64,
    target_level: i64,
) -> SqlResult<Subject> {
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO subjects (user_id, name, weight, difficulty, color, current_level, target_level) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![DEFAULT_USER_ID, name, weight, difficulty, color, current_level, target_level],
        )?;
        subject_by_id(connection, connection.last_insert_rowid())
    })
}

pub fn update_subject(
    connection: &mut Connection,
    id: i64,
    name: &str,
    weight: i64,
    difficulty: i64,
    color: &str,
    current_level: i64,
    target_level: i64,
) -> SqlResult<Subject> {
    run_write(connection, |connection| {
        connection.execute(
            "UPDATE subjects SET name = ?1, weight = ?2, difficulty = ?3, color = ?4, current_level = ?5, target_level = ?6 WHERE id = ?7 AND user_id = ?8",
            params![name, weight, difficulty, color, current_level, target_level, id, DEFAULT_USER_ID],
        )?;
        subject_by_id(connection, id)
    })
}

pub fn delete_subject(connection: &mut Connection, id: i64) -> SqlResult<bool> {
    run_write(connection, |connection| {
        Ok(connection.execute(
            "DELETE FROM subjects WHERE id = ?1 AND user_id = ?2",
            params![id, DEFAULT_USER_ID],
        )? > 0)
    })
}

pub fn update_subject_goals(connection: &mut Connection, id: i64, goal_accuracy: i64, goal_coverage: i64) -> SqlResult<Subject> {
    run_write(connection, |connection| {
        connection.execute(
            "UPDATE subjects SET goal_accuracy = ?1, goal_coverage = ?2 WHERE id = ?3 AND user_id = ?4",
            params![goal_accuracy, goal_coverage, id, DEFAULT_USER_ID],
        )?;
        subject_by_id(connection, id)
    })
}

fn topic_from_row(row: &Row<'_>) -> SqlResult<Topic> {
    Ok(Topic {
        id: row.get("id")?,
        user_id: row.get("user_id")?,
        subject_id: row.get("subject_id")?,
        name: row.get("name")?,
        status: row.get("status")?,
        created_at: row.get("created_at")?,
    })
}

const TOPIC_COLUMNS: &str = "id, user_id, subject_id, name, status, created_at";

pub fn list_topics(connection: &Connection) -> SqlResult<Vec<Topic>> {
    let mut statement = connection.prepare(
        &format!(
            "SELECT {TOPIC_COLUMNS} FROM topics WHERE user_id = ?1
             ORDER BY subject_id ASC, CASE status WHEN 'concluido' THEN 2 WHEN 'em_andamento' THEN 1 ELSE 0 END ASC, name COLLATE NOCASE"
        ),
    )?;
    statement
        .query_map(params![DEFAULT_USER_ID], topic_from_row)?
        .collect()
}

fn topic_by_id(connection: &Connection, id: i64) -> SqlResult<Topic> {
    connection.query_row(
        &format!("SELECT {TOPIC_COLUMNS} FROM topics WHERE id = ?1 AND user_id = ?2"),
        params![id, DEFAULT_USER_ID],
        topic_from_row,
    )
}

pub fn insert_topic(connection: &mut Connection, subject_id: i64, name: &str, status: &str) -> SqlResult<Topic> {
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO topics (user_id, subject_id, name, status) VALUES (?1, ?2, ?3, ?4)",
            params![DEFAULT_USER_ID, subject_id, name, status],
        )?;
        topic_by_id(connection, connection.last_insert_rowid())
    })
}

pub fn update_topic(connection: &mut Connection, id: i64, subject_id: i64, name: &str, status: &str) -> SqlResult<Topic> {
    run_write(connection, |connection| {
        connection.execute(
            "UPDATE topics SET subject_id = ?1, name = ?2, status = ?3 WHERE id = ?4 AND user_id = ?5",
            params![subject_id, name, status, id, DEFAULT_USER_ID],
        )?;
        topic_by_id(connection, id)
    })
}

pub fn delete_topic(connection: &mut Connection, id: i64) -> SqlResult<bool> {
    run_write(connection, |connection| {
        Ok(connection.execute(
            "DELETE FROM topics WHERE id = ?1 AND user_id = ?2",
            params![id, DEFAULT_USER_ID],
        )? > 0)
    })
}

fn allocation_from_row(row: &Row<'_>) -> SqlResult<DayAllocation> {
    Ok(DayAllocation {
        id: row.get("id")?,
        subject_id: row.get("subject_id")?,
        subject_name: row.get("subject_name")?,
        color: row.get("color")?,
        weekday: row.get("weekday")?,
        minutes: row.get("minutes")?,
        note: row.get("note")?,
    })
}

const ALLOCATION_COLUMNS: &str = "a.id, a.subject_id, s.name AS subject_name, s.color AS color, a.weekday, a.minutes, a.note";

pub fn list_day_allocations(connection: &Connection) -> SqlResult<Vec<DayAllocation>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {ALLOCATION_COLUMNS}
         FROM day_allocations a JOIN subjects s ON s.id = a.subject_id
         WHERE a.user_id = ?1 ORDER BY a.weekday ASC, s.name COLLATE NOCASE"
    ))?;
    statement.query_map(params![DEFAULT_USER_ID], allocation_from_row)?.collect()
}

pub fn save_day_allocation(connection: &mut Connection, input: &DayAllocationInput) -> SqlResult<Vec<DayAllocation>> {
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO day_allocations (user_id, subject_id, weekday, minutes, note)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(subject_id) DO UPDATE SET weekday = excluded.weekday, minutes = excluded.minutes,
               note = excluded.note, created_at = CURRENT_TIMESTAMP",
            params![DEFAULT_USER_ID, input.subject_id, input.weekday, input.minutes, input.note],
        )?;
        list_day_allocations(connection)
    })
}

pub fn delete_day_allocation(connection: &mut Connection, subject_id: i64) -> SqlResult<Vec<DayAllocation>> {
    run_write(connection, |connection| {
        connection.execute(
            "DELETE FROM day_allocations WHERE subject_id = ?1 AND user_id = ?2",
            params![subject_id, DEFAULT_USER_ID],
        )?;
        list_day_allocations(connection)
    })
}

pub fn get_profile(connection: &Connection) -> SqlResult<Profile> {
    connection.query_row(
        "SELECT daily_hours, weekly_days, exam_track, start_date, exam_date, study_days FROM user_settings WHERE user_id = ?1",
        params![DEFAULT_USER_ID],
        |row| {
            let weekly_days: i64 = row.get(1)?;
            let study_days_raw: Option<String> = row.get(5)?;
            let study_days = match study_days_raw {
                Some(raw) if !raw.trim().is_empty() => serde_json::from_str(&raw).unwrap_or_default(),
                _ => (0..weekly_days).collect(),
            };
            Ok(Profile {
                daily_hours: row.get(0)?,
                weekly_days,
                exam_track: row.get(2)?,
                start_date: row.get(3)?,
                exam_date: row.get(4)?,
                study_days,
            })
        },
    )
}

pub fn update_profile(connection: &mut Connection, profile: &ProfileInput) -> SqlResult<Profile> {
    run_write(connection, |connection| {
        let study_days_json = serde_json::to_string(&profile.study_days).unwrap_or_else(|_| "[]".into());
        connection.execute(
            "UPDATE user_settings SET daily_hours = ?1, weekly_days = ?2, exam_track = ?3, start_date = ?4, exam_date = ?5, study_days = ?6 WHERE user_id = ?7",
            params![profile.daily_hours, profile.weekly_days, profile.exam_track, profile.start_date, profile.exam_date, study_days_json, DEFAULT_USER_ID],
        )?;
        get_profile(connection)
    })
}

fn material_from_row(row: &Row<'_>) -> SqlResult<StudyMaterial> {
    let tags_json: String = row.get("tags_json")?;
    Ok(StudyMaterial {
        id: row.get("id")?,
        user_id: row.get("user_id")?,
        subject_id: row.get("subject_id")?,
        title: row.get("title")?,
        category: row.get("category")?,
        url_path: row.get("url_path")?,
        status: row.get("status")?,
        tags: serde_json::from_str(&tags_json).unwrap_or_default(),
        front: row.get("front")?,
        topic: row.get("topic")?,
        page_focus: row.get("page_focus")?,
        topic_id: row.get("topic_id")?,
        current_page: row.get("current_page")?,
        total_pages: row.get("total_pages")?,
        remind_date: row.get("remind_date")?,
        study_strategy: row.get("study_strategy")?,
        created_at: row.get("created_at")?,
    })
}

const MATERIAL_COLUMNS: &str = "id, user_id, subject_id, topic_id, title, category, url_path, status, tags_json, front, topic, page_focus, current_page, total_pages, remind_date, study_strategy, created_at";

pub fn list_materials(connection: &Connection) -> SqlResult<Vec<StudyMaterial>> {
    let mut statement = connection.prepare(
        &format!("SELECT {MATERIAL_COLUMNS} FROM study_materials WHERE user_id = ?1 ORDER BY created_at DESC, id DESC"),
    )?;
    statement
        .query_map(params![DEFAULT_USER_ID], material_from_row)?
        .collect()
}

pub fn insert_material(connection: &mut Connection, input: &MaterialInput) -> SqlResult<StudyMaterial> {
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".into());
    let study_strategy = resolve_strategy(connection, input);
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO study_materials (user_id, subject_id, topic_id, title, category, url_path, status, tags_json, front, topic, page_focus, current_page, total_pages, remind_date, study_strategy)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![DEFAULT_USER_ID, input.subject_id, input.topic_id, input.title, input.category, input.url_path, input.status, tags_json, input.front, input.topic, input.page_focus, input.current_page, input.total_pages, input.remind_date, study_strategy],
        )?;
        material_by_id(connection, connection.last_insert_rowid())
    })
}

pub fn update_material(connection: &mut Connection, id: i64, input: &MaterialInput) -> SqlResult<StudyMaterial> {
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".into());
    let study_strategy = resolve_strategy(connection, input);
    run_write(connection, |connection| {
        connection.execute(
            "UPDATE study_materials SET subject_id = ?1, topic_id = ?2, title = ?3, category = ?4, url_path = ?5, status = ?6, tags_json = ?7,
               front = ?8, topic = ?9, page_focus = ?10, current_page = ?11, total_pages = ?12, remind_date = ?13, study_strategy = ?14
             WHERE id = ?15 AND user_id = ?16",
            params![input.subject_id, input.topic_id, input.title, input.category, input.url_path, input.status, tags_json,
                    input.front, input.topic, input.page_focus, input.current_page, input.total_pages, input.remind_date, study_strategy, id, DEFAULT_USER_ID],
        )?;
        material_by_id(connection, id)
    })
}

pub fn update_material_page(connection: &mut Connection, id: i64, current_page: i64) -> SqlResult<StudyMaterial> {
    run_write(connection, |connection| {
        connection.execute(
            "UPDATE study_materials SET current_page = ?1, status = CASE WHEN ?1 > 0 AND total_pages > 0 AND ?1 >= total_pages THEN 'concluido' ELSE status END
             WHERE id = ?2 AND user_id = ?3",
            params![current_page, id, DEFAULT_USER_ID],
        )?;
        material_by_id(connection, id)
    })
}

fn material_by_id(connection: &Connection, id: i64) -> SqlResult<StudyMaterial> {
    connection.query_row(
        &format!("SELECT {MATERIAL_COLUMNS} FROM study_materials WHERE id = ?1 AND user_id = ?2"),
        params![id, DEFAULT_USER_ID],
        material_from_row,
    )
}

pub fn delete_material(connection: &mut Connection, id: i64) -> SqlResult<bool> {
    run_write(connection, |connection| {
        Ok(connection.execute(
            "DELETE FROM study_materials WHERE id = ?1 AND user_id = ?2",
            params![id, DEFAULT_USER_ID],
        )? > 0)
    })
}

pub fn insert_question_result(connection: &mut Connection, input: &QuestionResultInput) -> SqlResult<QuestionResult> {
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO question_results (user_id, subject_id, topic_id, date, questions_total, questions_correct, studied_minutes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                DEFAULT_USER_ID,
                input.subject_id,
                input.topic_id,
                input.date,
                input.questions_total,
                input.questions_correct,
                input.studied_minutes
            ],
        )?;
        let id = connection.last_insert_rowid();
        connection.query_row(
            "SELECT qr.id, qr.subject_id, qr.topic_id, qr.date, qr.questions_total, qr.questions_correct, qr.studied_minutes
             FROM question_results qr WHERE qr.id = ?1",
            params![id],
            |row| Ok(QuestionResult {
                id: row.get(0)?,
                subject_id: row.get(1)?,
                topic_id: row.get(2)?,
                date: row.get(3)?,
                questions_total: row.get(4)?,
                questions_correct: row.get(5)?,
                studied_minutes: row.get(6)?,
            }),
        )
    })
}

pub fn save_daily_log(connection: &mut Connection, date: &str, total_hours: f64, allocation_data: &str) -> SqlResult<()> {
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO daily_logs (user_id, date, total_hours_available, allocated_data_json)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(user_id, date) DO UPDATE SET total_hours_available = excluded.total_hours_available,
               allocated_data_json = excluded.allocated_data_json, created_at = CURRENT_TIMESTAMP",
            params![DEFAULT_USER_ID, date, total_hours, allocation_data],
        )?;
        Ok(())
    })
}

pub fn dashboard(connection: &Connection) -> SqlResult<DashboardData> {
    let profile = get_profile(connection)?;
    let subjects_count = connection.query_row(
        "SELECT COUNT(*) FROM subjects WHERE user_id = ?1", params![DEFAULT_USER_ID], |row| row.get(0),
    )?;
    let materials = connection.query_row(
        "SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END), 0)
         FROM study_materials WHERE user_id = ?1",
        params![DEFAULT_USER_ID],
        |row| Ok(MaterialProgress { total: row.get(0)?, completed: row.get(1)? }),
    )?;
    let questions = connection.query_row(
        "SELECT COALESCE(SUM(questions_total), 0), COALESCE(SUM(questions_correct), 0)
         FROM question_results WHERE user_id = ?1",
        params![DEFAULT_USER_ID],
        |row| {
            let total: i64 = row.get(0)?;
            let correct: i64 = row.get(1)?;
            Ok(QuestionProgress { total, correct, accuracy: percentage(correct, total) })
        },
    )?;
    let weekly_study_minutes = connection.query_row(
        "SELECT COALESCE(SUM(studied_minutes), 0) FROM question_results
         WHERE user_id = ?1 AND date >= date('now', '-6 days')",
        params![DEFAULT_USER_ID], |row| row.get(0),
    )?;

    let mut daily_statement = connection.prepare(
        "SELECT date, SUM(questions_total), SUM(questions_correct) FROM question_results
         WHERE user_id = ?1 AND date >= date('now', '-13 days')
         GROUP BY date ORDER BY date ASC",
    )?;
    let daily_performance = daily_statement.query_map(params![DEFAULT_USER_ID], |row| {
        let total: i64 = row.get(1)?;
        let correct: i64 = row.get(2)?;
        Ok(DailyPerformance { date: row.get(0)?, total, accuracy: percentage(correct, total) })
    })?.collect::<SqlResult<Vec<_>>>()?;

    let mut subject_statement = connection.prepare(
        "SELECT s.id, s.name, s.color, COALESCE(SUM(q.questions_total), 0),
            COALESCE(SUM(q.questions_correct), 0), COALESCE(SUM(q.studied_minutes), 0)
         FROM subjects s LEFT JOIN question_results q ON q.subject_id = s.id AND q.user_id = ?1
         WHERE s.user_id = ?1 GROUP BY s.id ORDER BY s.computed_ip DESC, s.name COLLATE NOCASE",
    )?;
    let subject_performance = subject_statement.query_map(params![DEFAULT_USER_ID], |row| {
        let total: i64 = row.get(3)?;
        let correct: i64 = row.get(4)?;
        Ok(SubjectPerformance {
            subject_id: row.get(0)?, subject_name: row.get(1)?, color: row.get(2)?,
            questions_total: total, questions_correct: correct, accuracy: percentage(correct, total), studied_minutes: row.get(5)?,
        })
    })?.collect::<SqlResult<Vec<_>>>()?;

    let mut reminders_statement = connection.prepare(
        "SELECT m.id, m.subject_id, s.name, m.title, m.front, m.topic, m.page_focus, m.remind_date,
                CAST(julianday(m.remind_date) - julianday('now') AS INTEGER)
         FROM study_materials m
         LEFT JOIN subjects s ON s.id = m.subject_id
         WHERE m.user_id = ?1 AND m.status != 'concluido'
           AND m.remind_date IS NOT NULL AND m.remind_date <= date('now', '+3 days')
         ORDER BY m.remind_date ASC, m.id DESC",
    )?;
    let reminders = reminders_statement.query_map(params![DEFAULT_USER_ID], |row| {
        Ok(MaterialReminder {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            subject_name: row.get(2)?,
            title: row.get(3)?,
            front: row.get(4)?,
            topic: row.get(5)?,
            page_focus: row.get(6)?,
            remind_date: row.get(7)?,
            days_left: row.get(8)?,
        })
    })?.collect::<SqlResult<Vec<_>>>()?;

    Ok(DashboardData {
        profile, subjects_count, materials, questions, weekly_study_minutes, daily_performance, subject_performance, reminders,
    })
}

fn percentage(correct: i64, total: i64) -> f64 {
    if total == 0 { 0.0 } else { ((correct as f64 / total as f64) * 1000.0).round() / 10.0 }
}

/// Evolução de acerto por matéria ao longo dos últimos 30 dias, com um ponto
/// por (matéria, dia). Usado no gráfico "melhoria ao longo do tempo".
pub fn subject_accuracy_trend(connection: &Connection) -> SqlResult<Vec<SubjectAccuracyPoint>> {
    let mut statement = connection.prepare(
        "SELECT s.id, s.name, s.color, q.date, SUM(q.questions_total), SUM(q.questions_correct)
         FROM question_results q JOIN subjects s ON s.id = q.subject_id
         WHERE q.user_id = ?1 AND q.date >= date('now', '-29 days')
         GROUP BY q.subject_id, q.date
         ORDER BY q.date ASC, s.name COLLATE NOCASE",
    )?;
    let rows = statement.query_map(params![DEFAULT_USER_ID], |row| {
        let total: i64 = row.get(4)?;
        let correct: i64 = row.get(5)?;
        Ok(SubjectAccuracyPoint {
            subject_id: row.get(0)?,
            subject_name: row.get(1)?,
            color: row.get(2)?,
            date: row.get(3)?,
            questions_total: total,
            accuracy: percentage(correct, total),
        })
    })?;
    rows.collect()
}

/// Tendência de Sobrecarga Progressiva de Foco: para cada matéria (e uma série
/// agregada "Geral", subject_id = 0), a % do tempo planejado que foi sustentado
/// por dia — quanto mais perto de 100%, maior a capacidade de deep work.
pub fn focus_overload_trend(connection: &Connection) -> SqlResult<Vec<FocusOverloadPoint>> {
    let mut statement = connection.prepare(
        "SELECT s.id, s.name, s.color, substr(p.started_at, 1, 10) AS day,
                COUNT(*) AS sessions,
                SUM(p.planned_minutes) AS planned,
                SUM(p.elapsed_minutes) AS elapsed,
                SUM(CASE WHEN p.completed = 1 AND p.interrupts = 0 AND p.exit_reason IS NULL THEN 1 ELSE 0 END) AS deep
         FROM focus_sessions p JOIN subjects s ON s.id = p.subject_id
         WHERE p.user_id = ?1 AND substr(p.started_at, 1, 10) >= date('now', '-29 days')
         GROUP BY p.subject_id, day
         ORDER BY day ASC, s.name COLLATE NOCASE",
    )?;
    let per_subject: Vec<(i64, String, String, String, i64, i64, i64, i64)> = statement
        .query_map(params![DEFAULT_USER_ID], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    use std::collections::BTreeMap;
    let mut general: BTreeMap<String, (i64, i64, i64)> = BTreeMap::new();
    for row in &per_subject {
        let entry = general.entry(row.3.clone()).or_insert((0, 0, 0));
        entry.0 += row.4;
        entry.1 += row.5;
        entry.2 += row.6;
    }

    let mut points: Vec<FocusOverloadPoint> = Vec::new();
    for (date, (sessions, planned, elapsed)) in general {
        points.push(FocusOverloadPoint {
            subject_id: 0,
            subject_name: "Geral".to_string(),
            color: "slate".to_string(),
            date: date.clone(),
            sessions,
            planned_minutes: planned,
            elapsed_minutes: elapsed,
            completion_rate: percentage(elapsed, planned),
            deep_work_sessions: per_subject
                .iter()
                .filter(|row| row.3 == date)
                .map(|row| row.7)
                .sum(),
        });
    }
    for (subject_id, name, color, date, sessions, planned, elapsed, deep) in per_subject {
        points.push(FocusOverloadPoint {
            subject_id,
            subject_name: name,
            color,
            date,
            sessions,
            planned_minutes: planned,
            elapsed_minutes: elapsed,
            completion_rate: percentage(elapsed, planned),
            deep_work_sessions: deep,
        });
    }
    points.sort_by(|a, b| a.date.cmp(&b.date).then_with(|| a.subject_id.cmp(&b.subject_id)));
    Ok(points)
}

fn format_period(granularity: &str, start_date: &str) -> String {
    let short = &start_date[5..];
    match granularity {
        "week" => format!("Sem. {short}"),
        "month" => format!("{}/{}", &start_date[5..7], &start_date[0..4]),
        "year" => start_date[0..4].to_string(),
        _ => short.to_string(),
    }
}

/// Agrega a evolução de acerto ao longo do tempo agrupando os lançamentos de
/// questões por dia, semana, mês ou ano.
pub fn performance_trend(
    connection: &Connection,
    granularity: &str,
    subject_id: Option<i64>,
    topic_id: Option<i64>,
) -> SqlResult<Vec<PerformancePoint>> {
    let period = match granularity {
        "week" => "strftime('%Y', date) || '-W' || printf('%02d', CAST(strftime('%W', date) AS INTEGER))",
        "month" => "strftime('%Y-%m', date)",
        "year" => "strftime('%Y', date)",
        _ => "date",
    };
    use rusqlite::types::Value as SqlValue;
    let mut clauses = vec!["WHERE user_id = ?1".to_string()];
    let mut values: Vec<SqlValue> = vec![SqlValue::Integer(DEFAULT_USER_ID)];
    if let Some(subject_id) = subject_id {
        clauses.push("AND subject_id = ?2".to_string());
        values.push(SqlValue::Integer(subject_id));
        if let Some(topic_id) = topic_id {
            clauses.push("AND (topic_id = ?3 OR ?3 IS NULL)".to_string());
            values.push(SqlValue::Integer(topic_id));
        }
    }
    let sql = format!(
        "SELECT {period} AS period,
                MIN(date) AS start_date,
                SUM(questions_total),
                SUM(questions_correct)
         FROM question_results
         {where_clause}
         GROUP BY period
         ORDER BY start_date ASC",
        where_clause = clauses.join(" ")
    );
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map(params_from_iter(values.iter()), |row| {
        let total: i64 = row.get(2)?;
        let correct: i64 = row.get(3)?;
        let start_date: String = row.get(1)?;
        Ok(PerformancePoint {
            label: format_period(granularity, &start_date),
            start_date,
            questions_total: total,
            questions_correct: correct,
            accuracy: percentage(correct, total),
        })
    })?;
    rows.collect()
}

#[derive(Default, Clone, Copy)]
struct SubjectStats {
    total: i64,
    correct: i64,
    minutes: i64,
}

impl SubjectStats {
    fn accuracy(self) -> f64 {
        percentage(self.correct, self.total)
    }
}

fn question_stats(connection: &Connection, subject_id: i64, filter: &str) -> SqlResult<SubjectStats> {
    connection.query_row(
        &format!(
            "SELECT COALESCE(SUM(questions_total), 0), COALESCE(SUM(questions_correct), 0), COALESCE(SUM(studied_minutes), 0)
             FROM question_results WHERE user_id = ?1 AND subject_id = ?2 AND {filter}"
        ),
        params![DEFAULT_USER_ID, subject_id],
        |row| Ok(SubjectStats { total: row.get(0)?, correct: row.get(1)?, minutes: row.get(2)? }),
    )
}

fn clamp01(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

/// Ranking de prioridade por matéria: quanto maior o score, maior a prioridade.
/// Peso estratégico (IP) + déficit contra a meta de acerto + ritmo recente de
/// questões + tendência de queda/piora. A setinha ↑/↓ é derivada da diferença
/// entre a posição atual e a posição da janela anterior (dias -14 a -8).
pub fn priority_ranking(connection: &Connection) -> SqlResult<Vec<SubjectRanking>> {
    let subjects = list_subjects(connection)?;
    let max_weight = subjects.iter().map(|subject| subject.weight).max().unwrap_or(1);

    let mut stats_rows: Vec<(Subject, SubjectStats, SubjectStats, SubjectStats)> = Vec::new();
    let mut max_recent_volume = 0;
    let mut max_prev_volume = 0;
    for subject in &subjects {
        let all = question_stats(connection, subject.id, "1 = 1")?;
        let recent = question_stats(connection, subject.id, "date >= date('now', '-7 days')")?;
        let prev = question_stats(
            connection,
            subject.id,
            "date >= date('now', '-14 days') AND date < date('now', '-7 days')",
        )?;
        max_recent_volume = max_recent_volume.max(recent.total);
        max_prev_volume = max_prev_volume.max(prev.total);
        stats_rows.push((subject.clone(), all, recent, prev));
    }

    let score_for = |weight: i64, goal: i64, all: SubjectStats, recent: SubjectStats, has_prev: bool, prev_acc: f64| -> f64 {
        let strategy = weight as f64 / max_weight as f64 * 3.0;
        let deficit = if all.total > 0 {
            clamp01((goal as f64 - all.accuracy()) / 100.0) * 4.0
        } else {
            4.0
        };
        let volume = if max_recent_volume > 0 {
            clamp01(recent.total as f64 / max_recent_volume as f64) * 1.5
        } else {
            0.0
        };
        let trend = if has_prev && all.total > 0 {
            clamp01((prev_acc - all.accuracy()) / 100.0) * 1.5
        } else if all.total > 0 {
            0.75
        } else {
            0.0
        };
        strategy + deficit + volume + trend
    };

    struct Scored {
        subject: Subject,
        all: SubjectStats,
        recent: SubjectStats,
        prev: SubjectStats,
        priority: f64,
    }

    let mut scored_rows: Vec<Scored> = stats_rows
        .into_iter()
        .map(|(subject, all, recent, prev)| {
            let priority = score_for(subject.weight, subject.goal_accuracy, all, recent, prev.total > 0, prev.accuracy());
            Scored { subject, all, recent, prev, priority }
        })
        .collect();
    scored_rows.sort_by(|a, b| b.priority.partial_cmp(&a.priority).unwrap_or(std::cmp::Ordering::Equal).then_with(|| a.subject.name.cmp(&b.subject.name)));
    // Recalcula prioridade usando apenas a janela anterior, para comparar posições.
    let mut prev_rank: Vec<Option<i64>> = Vec::with_capacity(scored_rows.len());
    let mut prev_sorted: Vec<(i64, f64)> = scored_rows
        .iter()
        .filter(|row| row.prev.total > 0)
        .map(|row| {
            let prev_priority = score_for(row.subject.weight, row.subject.goal_accuracy, row.prev, SubjectStats { ..row.prev }, false, 0.0);
            (row.subject.id, prev_priority)
        })
        .collect();
    prev_sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    for row in &scored_rows {
        if row.prev.total > 0 {
            if let Some(pos) = prev_sorted.iter().position(|(id, _)| *id == row.subject.id) {
                prev_rank.push(Some(pos as i64 + 1));
                continue;
            }
        }
        prev_rank.push(None);
    }

    Ok(scored_rows
        .iter()
        .enumerate()
        .map(|(index, row)| {
            let rank = index as i64 + 1;
            let movement = match prev_rank[index] {
                Some(prev) if prev > rank => "up".to_string(),
                Some(prev) if prev < rank => "down".to_string(),
                Some(_) => "same".to_string(),
                None => "new".to_string(),
            };
            SubjectRanking {
                rank,
                movement,
                subject: row.subject.clone(),
                strategy_score: round1(row.subject.weight as f64 / max_weight as f64 * 3.0),
                deficit_score: round1(if row.all.total > 0 {
                    clamp01((row.subject.goal_accuracy as f64 - row.all.accuracy()) / 100.0) * 4.0
                } else {
                    4.0
                }),
                volume_score: round1(if max_recent_volume > 0 {
                    clamp01(row.recent.total as f64 / max_recent_volume as f64) * 1.5
                } else {
                    0.0
                }),
                trend_score: round1(if row.prev.total > 0 && row.all.total > 0 {
                    clamp01((row.prev.accuracy() - row.all.accuracy()) / 100.0) * 1.5
                } else if row.all.total > 0 {
                    0.75
                } else {
                    0.0
                }),
                priority_score: round1(row.priority),
                accuracy: round1(row.all.accuracy()),
                recent_accuracy: round1(row.recent.accuracy()),
                previous_accuracy: round1(row.prev.accuracy()),
                questions_total: row.all.total,
                studied_minutes: row.all.minutes,
            }
        })
        .collect())
}

fn normalize_text(value: &str) -> String {
    value.trim().to_lowercase()
}

fn resolve_strategy(connection: &Connection, input: &MaterialInput) -> Option<String> {
    if let Some(value) = &input.study_strategy {
        if !value.trim().is_empty() {
            return Some(value.trim().to_string());
        }
    }
    match_strategy(connection, &input.title, &input.category)
        .ok()
        .flatten()
        .map(|suggestion| suggestion.tactic)
}

pub fn list_material_strategies(connection: &Connection) -> SqlResult<Vec<MaterialStrategy>> {
    let mut statement = connection.prepare(
        "SELECT id, keywords, tactic, reason, intensity FROM material_strategies ORDER BY id",
    )?;
    statement
        .query_map([], |row| {
            Ok(MaterialStrategy {
                id: row.get(0)?,
                keywords: row.get(1)?,
                tactic: row.get(2)?,
                reason: row.get(3)?,
                intensity: row.get(4)?,
            })
        })?
        .collect()
}

pub fn match_strategy(
    connection: &Connection,
    title: &str,
    category: &str,
) -> SqlResult<Option<StrategyMatch>> {
    let haystack = normalize_text(&format!("{title} {category}"));
    for strategy in list_material_strategies(connection)? {
        let matched = strategy
            .keywords
            .split(',')
            .map(str::trim)
            .filter(|keyword| !keyword.is_empty())
            .any(|keyword| haystack.contains(&normalize_text(keyword)));
        if matched {
            return Ok(Some(StrategyMatch {
                tactic: strategy.tactic,
                reason: strategy.reason,
                intensity: strategy.intensity,
            }));
        }
    }
    Ok(None)
}

pub fn suggest_focus_timebox(
    connection: &Connection,
    subject_id: i64,
) -> SqlResult<TimeboxSuggestion> {
    use crate::models::Subject;

    let mut statement = connection.prepare(
        "SELECT planned_minutes, completed, exit_reason, elapsed_minutes,
                planned_minutes AS planned
         FROM focus_sessions
         WHERE user_id = ?1 AND subject_id = ?2
         ORDER BY started_at DESC
         LIMIT 8",
    )?;
    let recent: Vec<(i64, bool, Option<String>, i64)> = statement
        .query_map(params![DEFAULT_USER_ID, subject_id], |row| {
            Ok((
                row.get::<_, i64>("planned_minutes")?,
                row.get::<_, bool>("completed")?,
                row.get::<_, Option<String>>("exit_reason")?,
                row.get::<_, i64>("elapsed_minutes")?,
            ))
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    let subject: Subject = subject_by_id(connection, subject_id)?;
    let sample = recent.len().max(1);
    let completed_count = recent.iter().filter(|row| row.1).count();
    let resistance_index = clamp01(completed_count as f64 / sample as f64);

    let mut completed_streak = 0i64;
    for row in &recent {
        if row.1 {
            completed_streak += 1;
        } else {
            break;
        }
    }

    let previous_minutes = recent
        .first()
        .map(|row| row.0)
        .unwrap_or(30);

    let last_failed = recent
        .first()
        .filter(|row| !row.1)
        .map(|row| row.2.as_deref().unwrap_or(""));

    let suggested_minutes = if recent.is_empty() {
        30
    } else if completed_streak >= 2 && resistance_index >= 0.6 {
        (previous_minutes + 5).clamp(15, 120)
    } else if last_failed.is_some_and(|reason| matches!(reason, "fadiga_metabolica" | "dificuldade_materia" | "distracao_externa")) {
        (previous_minutes - 5).clamp(15, 120)
    } else {
        previous_minutes
    };

    let reason = if recent.is_empty() {
        "Sem histórico: partimos de um bloco base de 30 minutos.".to_string()
    } else if suggested_minutes > previous_minutes {
        "2+ janelas concluídas em sequência (ZDP sustentada): +5 min de sobrecarga progressiva."
            .to_string()
    } else if suggested_minutes < previous_minutes {
        "Saída precoce recente (fadiga/distração/dificuldade): retração de 5 min para recompor a base."
            .to_string()
    } else {
        "Janela estável: mantenha o timebox atual e evolua quando houver 2 vitórias seguidas."
            .to_string()
    };

    Ok(TimeboxSuggestion {
        subject_id,
        subject_name: subject.name,
        color: subject.color,
        resistance_index,
        completed_streak,
        previous_minutes,
        suggested_minutes,
        reason,
    })
}

fn focus_from_row(row: &Row<'_>, subject_name: &str, color: &str, material_title: Option<&str>) -> SqlResult<FocusSession> {
    Ok(FocusSession {
        id: row.get("id")?,
        subject_id: row.get("subject_id")?,
        subject_name: subject_name.to_string(),
        color: color.to_string(),
        material_id: row.get("material_id")?,
        material_title: material_title.map(str::to_string),
        goal_type: row.get("goal_type")?,
        goal_text: row.get("goal_text")?,
        page_start: row.get("page_start")?,
        page_end: row.get("page_end")?,
        planned_minutes: row.get("planned_minutes")?,
        elapsed_minutes: row.get("elapsed_minutes")?,
        interrupts: row.get("interrupts")?,
        completion_rate: row.get("completion_rate")?,
        zone: FocusZone::from_db(&row.get::<_, String>("zone")?),
        exit_reason: row.get("exit_reason")?,
        completed: row.get("completed")?,
        status: row.get("status")?,
        completion_percentage: row.get("completion_percentage")?,
        started_at: row.get("started_at")?,
    })
}

pub fn list_focus_sessions(connection: &Connection) -> SqlResult<Vec<FocusSession>> {
    let mut statement = connection.prepare(
        "SELECT s.id, s.user_id, s.subject_id, s.material_id, s.goal_type, s.goal_text,
                s.page_start, s.page_end, s.planned_minutes, s.elapsed_minutes, s.interrupts,
                s.completion_rate, s.zone, s.exit_reason, s.completed, s.status, s.completion_percentage, s.started_at,
                sub.name AS subject_name, sub.color, m.title AS material_title
         FROM focus_sessions s
         JOIN subjects sub ON sub.id = s.subject_id
         LEFT JOIN study_materials m ON m.id = s.material_id
         WHERE s.user_id = ?1
         ORDER BY s.started_at DESC
         LIMIT 100",
    )?;
    statement
        .query_map(params![DEFAULT_USER_ID], |row| {
            focus_from_row(row, &row.get::<_, String>("subject_name")?, &row.get::<_, String>("color")?, row.get::<_, Option<String>>("material_title")?.as_deref())
        })?
        .collect()
}

/// Query preparada do insert na tabela `focus_sessions`. Retorna o id da sessão.
fn insert_focus_session(
    connection: &Connection,
    input: &FocusSessionInput,
    completion_rate: f64,
    completed: bool,
    status: &str,
    completion_percentage: f64,
    started_at: &str,
    ended_at: &str,
    zone: FocusZone,
) -> SqlResult<i64> {
    connection.execute(
        "INSERT INTO focus_sessions
            (user_id, subject_id, material_id, goal_type, goal_text, page_start, page_end,
             planned_minutes, elapsed_minutes, interrupts, completion_rate, zone, exit_reason,
             completed, status, completion_percentage, started_at, ended_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            DEFAULT_USER_ID,
            input.subject_id,
            input.material_id,
            input.goal_type,
            input.goal_text,
            input.page_start,
            input.page_end,
            input.planned_minutes,
            input.elapsed_minutes,
            input.interrupts,
            round2(completion_rate),
            zone.as_db(),
            input.exit_reason,
            completed,
            status,
            round1(completion_percentage),
            started_at,
            ended_at
        ],
    )?;
    Ok(connection.last_insert_rowid())
}

pub fn complete_focus_session(
    connection: &mut Connection,
    input: &FocusSessionInput,
) -> SqlResult<SessionSummary> {
    run_write(connection, |connection| {
        let subject = subject_by_id(connection, input.subject_id)?;
        let completion_rate = clamp01(input.elapsed_minutes as f64 / input.planned_minutes.max(1) as f64);
        let finished_goal_early = input.exit_reason.as_deref() == Some("meta_concluida");
        let completed = completion_rate >= 1.0 || finished_goal_early;
        let status = if completed { "done" } else { "partial" };
        let ended_at = chrono::Local::now().date_naive().to_string();
        let completion_percentage = match input.completion_percentage {
            Some(value) => value.clamp(0.0, 100.0),
            None if completed => 100.0,
            None => completion_rate * 100.0,
        };
        let zone = FocusZone::from_completion_rate(completion_rate);

        insert_focus_session(
            connection,
            input,
            completion_rate,
            completed,
            status,
            completion_percentage,
            &input.started_at,
            &ended_at,
            zone,
        )?;

        if let (Some(material_id), Some(page_end)) = (input.material_id, input.page_end) {
            if page_end > 0 {
                connection.execute(
                    "UPDATE study_materials SET current_page = MAX(current_page, ?1) WHERE id = ?2 AND user_id = ?3",
                    params![page_end, material_id, DEFAULT_USER_ID],
                )?;
            }
        }

        let suggestion = suggest_focus_timebox(connection, input.subject_id)?;
        let deep_work = completion_rate >= 1.0 && input.interrupts == 0 && input.exit_reason.is_none();
        let efficiency_gain = if deep_work && input.elapsed_minutes > 0 {
            apply_efficiency_learning(connection, input.subject_id)?
        } else {
            None
        };

        Ok(SessionSummary {
            subject_id: input.subject_id,
            subject_name: subject.name,
            planned_minutes: input.planned_minutes,
            elapsed_minutes: input.elapsed_minutes,
            interrupts: input.interrupts,
            completion_rate: round2(completion_rate),
            exit_reason: input.exit_reason.clone(),
            completion_percentage: Some(round1(completion_percentage)),
            deep_work,
            suggested_next: suggestion.suggested_minutes,
            suggestion_reason: suggestion.reason,
            efficiency_gain,
        })
    })
}

pub fn log_brain_dump(connection: &mut Connection, input: &BrainDumpLogInput) -> SqlResult<BrainDumpLog> {
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO brain_dump_logs (user_id, subject_id, note) VALUES (?1, ?2, ?3)",
            params![DEFAULT_USER_ID, input.subject_id, input.note],
        )?;
        connection.query_row(
            "SELECT d.id, d.subject_id, d.note, d.created_at, sub.name AS subject_name
             FROM brain_dump_logs d
             LEFT JOIN subjects sub ON sub.id = d.subject_id
             WHERE d.id = ?1 AND d.user_id = ?2",
            params![connection.last_insert_rowid(), DEFAULT_USER_ID],
            |row| {
                Ok(BrainDumpLog {
                    id: row.get(0)?,
                    subject_id: row.get(1)?,
                    subject_name: row.get(2)?,
                    note: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
    })
}

pub fn list_brain_dumps(connection: &Connection) -> SqlResult<Vec<BrainDumpLog>> {
    let mut statement = connection.prepare(
        "SELECT d.id, d.subject_id, d.note, d.created_at, sub.name AS subject_name
         FROM brain_dump_logs d
         LEFT JOIN subjects sub ON sub.id = d.subject_id
         WHERE d.user_id = ?1
         ORDER BY d.created_at DESC
         LIMIT 100",
    )?;
    statement
        .query_map(params![DEFAULT_USER_ID], |row| {
            Ok(BrainDumpLog {
                id: row.get(0)?,
                subject_id: row.get(1)?,
                subject_name: row.get(2)?,
                note: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?
        .collect()
}

pub fn learning_speed(connection: &Connection, subject_id: Option<i64>) -> SqlResult<Vec<LearningSpeed>> {
    let mut statement = connection.prepare(&format!(
        "SELECT s.material_id, m.title AS material_title, COUNT(*) AS sessions,
                SUM(s.elapsed_minutes) AS minutes_total,
                SUM(CASE WHEN s.goal_type = 'paginas' THEN MAX(s.page_end - s.page_start, 0) ELSE 0 END) AS pages_done,
                SUM(CASE WHEN s.goal_type = 'exercicios' THEN 1 ELSE 0 END) AS exercises_done
         FROM focus_sessions s
         LEFT JOIN study_materials m ON m.id = s.material_id
         WHERE s.user_id = ?1 {0}
         GROUP BY s.material_id
         HAVING SUM(s.elapsed_minutes) > 0
         ORDER BY minutes_total DESC",
        if subject_id.is_some() { "AND s.subject_id = ?2" } else { "" }
    ))?;

    let rows = if let Some(subject_id) = subject_id {
        statement
            .query_map(params![DEFAULT_USER_ID, subject_id], |row| {
                Ok(LearningSpeed {
                    material_id: row.get(0)?,
                    material_title: row.get(1)?,
                    sessions: row.get(2)?,
                    minutes_total: row.get(3)?,
                    pages_done: row.get(4)?,
                    minutes_per_page: {
                        let pages: Option<i64> = row.get(4)?;
                        let minutes: f64 = row.get::<_, i64>(3)? as f64;
                        pages.filter(|value| *value > 0).map(|value| round1(minutes / value as f64))
                    },
                    exercises_done: row.get(5)?,
                    minutes_per_exercise: None,
                })
            })?
            .collect::<SqlResult<Vec<_>>>()?
    } else {
        statement
            .query_map(params![DEFAULT_USER_ID], |row| {
                Ok(LearningSpeed {
                    material_id: row.get(0)?,
                    material_title: row.get(1)?,
                    sessions: row.get(2)?,
                    minutes_total: row.get(3)?,
                    pages_done: row.get(4)?,
                    minutes_per_page: {
                        let pages: Option<i64> = row.get(4)?;
                        let minutes: f64 = row.get::<_, i64>(3)? as f64;
                        pages.filter(|value| *value > 0).map(|value| round1(minutes / value as f64))
                    },
                    exercises_done: row.get(5)?,
                    minutes_per_exercise: None,
                })
            })?
            .collect::<SqlResult<Vec<_>>>()?
    };

    Ok(rows)
}

/// Ordena matérias agrupando por matéria-mãe (prefixo antes de " · ").
/// Grupos com maior pico de risco vêm primeiro; dentro do grupo, mantém a
/// ordem original (ordem do catálogo), garantindo sub-áreas em sequência.
fn sequence_by_parent(rows: Vec<(i64, String, String, i64)>) -> Vec<(i64, String, String, i64)> {
    let mut buckets: Vec<(String, Vec<(i64, String, String, i64)>)> = Vec::new();
    for row in rows {
        let parent = row
            .1
            .split_once('·')
            .map(|(head, _)| head.trim().to_string())
            .unwrap_or_else(|| row.1.clone());
        match buckets.iter_mut().find(|bucket| bucket.0 == parent) {
            Some(bucket) => bucket.1.push(row),
            None => buckets.push((parent, vec![row])),
        }
    }
    buckets.sort_by(|left, right| {
        let left_peak = left.1.iter().map(|row| row.3).max().unwrap_or(0);
        let right_peak = right.1.iter().map(|row| row.3).max().unwrap_or(0);
        right_peak
            .cmp(&left_peak)
            .then_with(|| left.0.cmp(&right.0))
    });
    buckets
        .into_iter()
        .flat_map(|(_, rows)| rows)
        .collect()
}

pub fn generate_study_plan(connection: &Connection, input: &PlanInput) -> SqlResult<PlanResponse> {
    use chrono::{Datelike, Duration, NaiveDate};

    let start = NaiveDate::parse_from_str(&input.start_date, "%Y-%m-%d")
        .map_err(|_| rusqlite::Error::InvalidParameterName("start_date".into()))?;
    let exam = NaiveDate::parse_from_str(&input.exam_date, "%Y-%m-%d")
        .map_err(|_| rusqlite::Error::InvalidParameterName("exam_date".into()))?;
    if exam <= start {
        return Err(rusqlite::Error::InvalidParameterName(
            "exam_date precisa ser posterior a start_date".into(),
        ));
    }

    let horizon_days = (exam - start).num_days();
    let weeks = (horizon_days.max(1) / 7).max(1);
    // total_hours chega como carga SEMANAL (diário × dias/semana no wizard).
    // Distribui essa carga pelos dias do horizonte, em blocos de 5, sem cortar.
    let total_days = (horizon_days + 1).max(1) as f64;
    let weekly_minutes = input.total_hours.clamp(0.5, 24.0 * 7.0) * 60.0;
    let daily_minutes = (weekly_minutes * weeks as f64 / total_days / 5.0).round() as i64 * 5;
    let daily_minutes = daily_minutes.max(5);

    let subjects = list_subjects(connection)?;
    let mut risk: Vec<(i64, String, String, i64)> = subjects
        .iter()
        .map(|subject| {
            let risk = subject.computed_ip + 2 * (subject.target_level - subject.current_level).max(0);
            (subject.id, subject.name.clone(), subject.color.clone(), risk)
        })
        .collect();
    // Sub-áreas ("Matéria · Sub") vêm em sequência: agrupa por matéria-mãe,
    // pais com maior pico de risco primeiro, e dentro do grupo preserva a
    // ordem do catálogo para a rota alternar as sub-áreas uma após a outra.
    risk = sequence_by_parent(risk);

    let weekday_labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    let mut days = Vec::new();
    let limit = (horizon_days + 1).max(1).min(42) as usize;
    for offset in 0..limit {
        let date = start + Duration::days(offset as i64);
        let weekday = date.weekday().num_days_from_monday() as usize;
        let early_window = weekday <= 2;
        let primary_minutes = (daily_minutes as f64 * if early_window { 0.6 } else { 0.5 }).round() as i64;
        let primary_minutes = (primary_minutes / 5 * 5).max(15);

        // Rotação sem repetição: o bloco principal gira por todas as matérias
        // ordenadas por risco (IP + déficit de nível) em vez de repetir as de
        // maior escore todos os dias. Sem matérias, a rota fica vazia.
        let subject_count = risk.len();
        if subject_count == 0 {
            return Ok(PlanResponse {
                weeks,
                risk_name: None,
                days,
            });
        }
        let primary_index = offset % subject_count;
        let (id0, name0, color0, risk0) = &risk[primary_index];
        let secondary_index = (offset * 2 + 1) % subject_count;

        let mut focus = vec![PlanFocus {
            subject_id: *id0,
            subject_name: name0.clone(),
            color: color0.clone(),
            risk: *risk0,
            minutes: primary_minutes,
            slot: if early_window {
                "Janela matutina · aquecimento pós-sono".to_string()
            } else {
                "Bloco principal".to_string()
            },
        }];
        if subject_count > 1 && secondary_index != primary_index && daily_minutes - primary_minutes >= 10 {
            let (id1, name1, color1, risk1) = &risk[secondary_index];
            focus.push(PlanFocus {
                subject_id: *id1,
                subject_name: name1.clone(),
                color: color1.clone(),
                risk: *risk1,
                minutes: daily_minutes - primary_minutes,
                slot: if early_window {
                    "Segundo alvo · alternância".to_string()
                } else {
                    "Tarde · reforço de déficit".to_string()
                },
            });
        }
        days.push(PlanDay {
            date: date.format("%Y-%m-%d").to_string(),
            weekday_label: weekday_labels[weekday].to_string(),
            focus_subjects: focus,
        });
    }

    Ok(PlanResponse {
        weeks,
        risk_name: Some(risk[0].1.clone()),
        days,
    })
}

fn apply_efficiency_learning(connection: &Connection, subject_id: i64) -> SqlResult<Option<String>> {
    let faster_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM focus_sessions
         WHERE user_id = ?1 AND subject_id = ?2 AND status = 'done'
           AND elapsed_minutes > 0 AND elapsed_minutes * 100 < planned_minutes * 85
           AND substr(started_at, 1, 10) >= date('now', '-14 days')",
        params![DEFAULT_USER_ID, subject_id],
        |row| row.get(0),
    )?;

    if faster_count < 2 {
        return Ok(None);
    }

    let subject = subject_by_id(connection, subject_id)?;
    if subject.current_level >= subject.target_level {
        return Ok(None);
    }
    let new_level = subject.current_level + 1;
    let updated = connection.execute(
        "UPDATE subjects SET current_level = ?1 WHERE id = ?2 AND user_id = ?3",
        params![new_level, subject_id, DEFAULT_USER_ID],
    )?;
    if updated > 0 {
        Ok(Some(format!(
            "Domínio constatado: 2+ blocos concluídos abaixo do tempo planejado. Nível de domínio ↗ {new_level}. O IP efetivo caiu e o tempo excedente foi liberado para gargalos."
        )))
    } else {
        Ok(None)
    }
}

/// Gestão Adaptativa de Cronograma (CCPM): varre blocos `partial`/`pending`/
/// `buffered` da última semana, calcula o saldo devedor (planejado − executado)
/// e o realoca — sem efeito dominó — em `Project Buffers`: primeiro Sábado à
/// tarde (bloco de contenção), depois na semana seguinte. Manhãs de hiperfoco
/// são protegidas.
pub fn reschedule_buffer(connection: &mut Connection) -> SqlResult<ReschedulePlan> {
    run_write(connection, |connection| {
        let generated_date = today_iso();
        let profile = get_profile(connection)?;
        let saturday_capacity = (profile.daily_hours * 60.0 * 0.5).round().max(60.0) as i64;

        let mut statement = connection.prepare(
            "SELECT id, subject_id, goal_text, planned_minutes, elapsed_minutes
             FROM focus_sessions
             WHERE user_id = ?1 AND status IN ('partial', 'pending', 'buffered')
               AND substr(started_at, 1, 10) >= date('now', '-7 days')
             ORDER BY started_at ASC",
        )?;
        let tasks: Vec<(i64, i64, Option<String>, i64, i64)> = statement
            .query_map(params![DEFAULT_USER_ID], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
            })?
            .collect::<SqlResult<Vec<_>>>()?;

        let mut debt_by_subject: std::collections::BTreeMap<i64, i64> = std::collections::BTreeMap::new();
        let mut items: Vec<(i64, i64, Option<String>, i64, i64, i64)> = Vec::new();
        for (id, subject_id, goal, planned, elapsed) in &tasks {
            let debt = (planned - elapsed).max(0);
            if debt == 0 {
                connection.execute(
                    "UPDATE focus_sessions SET status = 'done' WHERE id = ?1",
                    params![id],
                )?;
                continue;
            }
            *debt_by_subject.entry(*subject_id).or_insert(0) += debt;
            items.push((*id, *subject_id, goal.clone(), *planned, *elapsed, debt));
        }

        let mut saturday_total = 0i64;
        let mut next_week_total = 0i64;
        let mut resolved: Vec<(i64, i64, Option<String>, i64, i64, i64, &'static str)> = Vec::new();
        connection.execute(
            "DELETE FROM buffer_allocations WHERE user_id = ?1 AND status = 'queued'",
            params![DEFAULT_USER_ID],
        )?;
        for (id, subject_id, goal, planned, elapsed, debt) in items {
            let destination: &'static str = if saturday_total + debt <= saturday_capacity {
                saturday_total += debt;
                "saturday"
            } else {
                next_week_total += debt;
                "next_week"
            };
            connection.execute(
                "INSERT INTO buffer_allocations (user_id, subject_id, source_session_id, debt_minutes, destination)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![DEFAULT_USER_ID, subject_id, id, debt, destination],
            )?;
            connection.execute(
                "UPDATE focus_sessions SET status = 'buffered' WHERE id = ?1 AND user_id = ?2",
                params![id, DEFAULT_USER_ID],
            )?;
            resolved.push((id, subject_id, goal, planned, elapsed, debt, destination));
        }

        let mut items_triaged: Vec<RescheduleItem> = Vec::new();
        for (id, subject_id, goal, planned, elapsed, debt, destination) in resolved {
            let subject = subject_by_id(connection, subject_id)?;
            items_triaged.push(RescheduleItem {
                source_session_id: id,
                subject_id,
                subject_name: subject.name.clone(),
                color: subject.color,
                goal,
                planned_minutes: planned,
                executed_minutes: elapsed,
                debt_minutes: debt,
                destination: destination.to_string(),
                destination_label: if destination == "saturday" {
                    "Sábado à tarde · Project Buffer".to_string()
                } else {
                    "Semana seguinte · redistribuição".to_string()
                },
            });
        }

        Ok(ReschedulePlan {
            generated_date,
            total_debt_minutes: debt_by_subject.values().sum(),
            saturday_minutes: saturday_total,
            next_week_minutes: next_week_total,
            protected_morning_hours: profile.weekly_days,
            items: items_triaged,
        })
    })
}

pub fn list_buffer_allocations(connection: &Connection) -> SqlResult<Vec<BufferAllocation>> {
    let mut statement = connection.prepare(
        "SELECT b.id, b.subject_id, sub.name, sub.color, s.goal_text, b.debt_minutes,
                b.destination, b.status, b.created_at
         FROM buffer_allocations b
         JOIN subjects sub ON sub.id = b.subject_id
         LEFT JOIN focus_sessions s ON s.id = b.source_session_id
         WHERE b.user_id = ?1
         ORDER BY b.created_at DESC
         LIMIT 50",
    )?;
    statement
        .query_map(params![DEFAULT_USER_ID], |row| {
            Ok(BufferAllocation {
                id: row.get(0)?,
                subject_id: row.get(1)?,
                subject_name: row.get(2)?,
                color: row.get(3)?,
                source_goal: row.get(4)?,
                debt_minutes: row.get(5)?,
                destination: row.get(6)?,
                status: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?
        .collect()
}

/* ---------------------------------------------------------------- */
/* Motor de Repetição Espaçada (modelo FSRS simplificado)            */
/* As fórmulas (today_iso, calculate_retrievability, due_date_iso,   */
/* grade_multiplier, grade_label, difficulty_scale...) vivem em       */
/* scheduler.rs; database.rs apenas importa.                          */
/* ---------------------------------------------------------------- */

struct SrsRow {
    id: i64,
    user_id: i64,
    subject_id: Option<i64>,
    subject_name: Option<String>,
    color: String,
    topic_id: Option<i64>,
    topic_name: Option<String>,
    concept: String,
    difficulty: f64,
    stability: f64,
    reps: i64,
    last_review_date: String,
    created_at: String,
}

fn srs_row_from_row(row: &Row<'_>) -> SqlResult<SrsRow> {
    Ok(SrsRow {
        id: row.get(0)?,
        user_id: row.get(1)?,
        subject_id: row.get(2)?,
        subject_name: row.get(3)?,
        color: row.get(4)?,
        topic_id: row.get(5)?,
        topic_name: row.get(6)?,
        concept: row.get(7)?,
        difficulty: row.get(8)?,
        stability: row.get(9)?,
        reps: row.get(10)?,
        last_review_date: row.get(11)?,
        created_at: row.get(12)?,
    })
}

const SRS_JOIN_SELECT: &str = "SELECT si.id, si.user_id, si.subject_id, sub.name, sub.color,
       si.topic_id, tp.name AS topic_name,
       si.concept, si.difficulty, si.stability, si.reps, si.last_review_date, si.created_at
       FROM spaced_repetition_items si
       LEFT JOIN subjects sub ON sub.id = si.subject_id
       LEFT JOIN topics tp ON tp.id = si.topic_id";

fn finish_item(raw: &SrsRow) -> SpacedRepetitionItem {
    SpacedRepetitionItem {
        id: raw.id,
        user_id: raw.user_id,
        subject_id: raw.subject_id,
        subject_name: raw.subject_name.clone(),
        color: raw.color.clone(),
        topic_id: raw.topic_id,
        topic_name: raw.topic_name.clone(),
        concept: raw.concept.clone(),
        difficulty: raw.difficulty,
        stability: raw.stability,
        reps: raw.reps,
        last_review_date: raw.last_review_date.clone(),
        due_date: due_date_iso(&raw.last_review_date, raw.stability),
        retrievability: (calculate_retrievability(
            raw.stability,
            days_since(&raw.last_review_date, &today_iso()),
        ) * 100.0).round() / 100.0,
        created_at: raw.created_at.clone(),
    }
}

fn memory_item_raw_by_id(connection: &Connection, id: i64) -> SqlResult<SrsRow> {
    connection.query_row(
        &format!("{SRS_JOIN_SELECT} WHERE si.id = ?1 AND si.user_id = ?2"),
        params![id, DEFAULT_USER_ID],
        srs_row_from_row,
    )
}

fn memory_item_by_id(connection: &Connection, id: i64) -> SqlResult<SpacedRepetitionItem> {
    Ok(finish_item(&memory_item_raw_by_id(connection, id)?))
}

pub fn list_memory_items(connection: &Connection) -> SqlResult<Vec<SpacedRepetitionItem>> {
    let mut statement = connection.prepare(&format!(
        "{SRS_JOIN_SELECT} WHERE si.user_id = ?1 ORDER BY si.created_at DESC, si.id DESC"
    ))?;
    let rows: Vec<SrsRow> = statement
        .query_map(params![DEFAULT_USER_ID], srs_row_from_row)?
        .collect::<SqlResult<Vec<_>>>()?;
    Ok(rows.iter().map(finish_item).collect())
}

/// Query preparada do insert na tabela `fsrs_reviews`. Retorna o id da revisão.
fn insert_fsrs_review(
    connection: &Connection,
    item_id: i64,
    grade: &str,
    stability_before: f64,
    stability_after: f64,
    retrievability: f64,
) -> SqlResult<i64> {
    connection.execute(
        "INSERT INTO fsrs_reviews (item_id, grade, stability_before, stability_after, retrievability)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![item_id, grade, stability_before, stability_after, retrievability],
    )?;
    Ok(connection.last_insert_rowid())
}

pub fn insert_memory_item(
    connection: &mut Connection,
    subject_id: Option<i64>,
    topic_id: Option<i64>,
    concept: &str,
    difficulty: f64,
) -> SqlResult<SpacedRepetitionItem> {
    let concept = concept.to_string();
    run_write(connection, |connection| {
        connection.execute(
            "INSERT INTO spaced_repetition_items (user_id, subject_id, topic_id, concept, difficulty, stability, reps, last_review_date)
             VALUES (?1, ?2, ?3, ?4, ?5, 1.0, 0, ?6)",
            params![
                DEFAULT_USER_ID,
                subject_id,
                topic_id,
                concept,
                difficulty,
                today_iso()
            ],
        )?;
        memory_item_by_id(connection, connection.last_insert_rowid())
    })
}

pub fn delete_memory_item(connection: &mut Connection, id: i64) -> SqlResult<bool> {
    run_write(connection, |connection| {
        Ok(connection.execute(
            "DELETE FROM spaced_repetition_items WHERE id = ?1 AND user_id = ?2",
            params![id, DEFAULT_USER_ID],
        )? > 0)
    })
}

pub fn review_memory_item(
    connection: &mut Connection,
    id: i64,
    grade: &str,
) -> SqlResult<SpacedRepetitionItem> {
    let grade = grade.to_string();
    run_write(connection, |connection| {
        let raw = memory_item_raw_by_id(connection, id)?;
        let stability_after =
            raw.stability * grade_multiplier(&grade) * difficulty_scale(raw.difficulty);
        connection.execute(
            "UPDATE spaced_repetition_items SET stability = ?1, reps = reps + 1, last_review_date = ?2
             WHERE id = ?3 AND user_id = ?4",
            params![stability_after, today_iso(), id, DEFAULT_USER_ID],
        )?;
        insert_fsrs_review(
            connection,
            id,
            &grade,
            raw.stability,
            stability_after,
            calculate_retrievability(raw.stability, days_since(&raw.last_review_date, &today_iso())),
        )?;
        memory_item_by_id(connection, id)
    })
}

pub fn list_fsrs_reviews_for_item(connection: &Connection, item_id: i64) -> SqlResult<Vec<FsrsReview>> {
    let mut statement = connection.prepare(
        "SELECT id, item_id, grade, stability_before, stability_after, retrievability, reviewed_at
         FROM fsrs_reviews WHERE item_id = ?1 ORDER BY reviewed_at DESC, id DESC LIMIT 50",
    )?;
    statement
        .query_map(params![item_id], |row| {
            let grade: String = row.get(2)?;
            Ok(FsrsReview {
                id: row.get(0)?,
                item_id: row.get(1)?,
                grade_label: grade_label(&grade),
                grade,
                stability_before: row.get(3)?,
                stability_after: row.get(4)?,
                retrievability: row.get(5)?,
                reviewed_at: row.get(6)?,
            })
        })?
        .collect()
}

pub fn memory_decay_projection(
    connection: &Connection,
    item_id: i64,
) -> SqlResult<MemoryDecayProjection> {
    let raw = memory_item_raw_by_id(connection, item_id)?;
    let today = today_iso();
    let elapsed = days_since(&raw.last_review_date, &today);
    let retrievability_today = calculate_retrievability(raw.stability, elapsed);
    let optimal_day = raw.stability.round().max(1.0) as i64;
    let optimal_date = due_date_iso(&raw.last_review_date, raw.stability);
    let horizon = (raw.stability * 4.0).ceil().max(30.0).min(180.0) as i64;
    let start = parse_date(&raw.last_review_date);

    let mut points = Vec::with_capacity(horizon as usize + 1);
    let mut anki_stability = raw.stability;
    let mut anki_elapsed = 0.0;
    for day in 0..=horizon {
        let plain = calculate_retrievability(raw.stability, day as f64);
        let reviewed = anki_elapsed > 0.0 && anki_elapsed >= anki_stability;
        let anki = if reviewed {
            // Revisão espaçada agendada hoje (grade "Bom"): restaura R e aumenta a Stability.
            anki_stability *= 2.2 * difficulty_scale(raw.difficulty);
            anki_elapsed = 0.0;
            1.0
        } else {
            calculate_retrievability(anki_stability, anki_elapsed)
        };
        points.push(MemoryPoint {
            item_id,
            day,
            date: (start + chrono::Duration::days(day)).to_string(),
            retrievability: plain,
            anki,
            reviewed,
        });
        anki_elapsed += 1.0;
    }

    Ok(MemoryDecayProjection {
        item_id,
        concept: raw.concept,
        subject_name: raw.subject_name,
        color: raw.color,
        stability: raw.stability,
        difficulty: raw.difficulty,
        optimal_day,
        optimal_date,
        retrievability_today,
        due_in_days: (optimal_day as f64 - elapsed).ceil().max(0.0) as i64,
        points,
    })
}

fn hex_for(color: &str) -> String {
    match color {
        "rose" => "#fb7185",
        "orange" => "#fb923c",
        "amber" => "#fbbf24",
        "yellow" => "#fde047",
        "lime" => "#a3e635",
        "green" | "emerald" => "#34d399",
        "teal" => "#2dd4bf",
        "cyan" => "#22d3ee",
        "sky" => "#38bdf8",
        "blue" => "#60a5fa",
        "indigo" => "#8b7cf6",
        "violet" => "#a78bfa",
        "purple" => "#c084fc",
        "fuchsia" => "#e879f9",
        "pink" => "#f472b6",
        "red" => "#ef4444",
        "gray" | "slate" => "#94a3b8",
        _ => "#94a3b8",
    }
    .to_string()
}

const PALETTE: [&str; 10] = [
    "#8b7cf6", "#a78bfa", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#fb923c", "#60a5fa",
    "#2dd4bf", "#f9a8d4",
];

/// Deliverable 1 — Query SQL (rusqlite): JOIN agregando Retrievability e Stability
/// das tabelas de itens e tópicos, agrupando por matéria e nicho.
/// A Retrievability atual é derivada em SQL via a fórmula FSRS
/// R = (1 + t/(9·S))⁻¹, com t = dias desde a última revisão (JULIANDAY).
#[derive(Clone)]
struct RetentionGroupRecord {
    subject_id: i64,
    subject_name: String,
    subject_color: String,
    topic_id: i64,
    topic_name: String,
}

fn retention_group_snapshot(connection: &Connection) -> SqlResult<Vec<RetentionGroupRecord>> {
    let mut statement = connection.prepare(
        "SELECT
           si.subject_id,
           COALESCE(sub.name,        'Sem matéria') AS subject_name,
           COALESCE(sub.color,       'slate')       AS subject_color,
           COALESCE(si.topic_id, 0)                 AS topic_id,
           COALESCE(tp.name,         'Sem nicho')   AS topic_name,
           COUNT(si.id)                             AS items,
           ROUND(AVG(si.stability), 2)              AS avg_stability,
           ROUND(AVG(
             1.0 / (1.0 + MAX(0.0, JULIANDAY('now') - JULIANDAY(si.last_review_date)) / (9.0 * si.stability))
           ) * 100.0, 2)                            AS avg_retrievability
         FROM spaced_repetition_items si
         LEFT JOIN subjects sub ON sub.id = si.subject_id
         LEFT JOIN topics tp    ON tp.id  = si.topic_id
         WHERE si.user_id = ?1
         GROUP BY si.subject_id, si.topic_id
         ORDER BY sub.name COLLATE NOCASE, tp.name COLLATE NOCASE",
    )?;
    let mut rows = Vec::new();
    let mut query = statement.query(params![DEFAULT_USER_ID])?;
    while let Some(row) = query.next()? {
        rows.push(RetentionGroupRecord {
            subject_id: row.get(0)?,
            subject_name: row.get(1)?,
            subject_color: row.get(2)?,
            topic_id: row.get(3)?,
            topic_name: row.get(4)?,
        });
    }
    Ok(rows)
}

struct RetentionSeriesBuilder<'a> {
    key: String,
    name: String,
    level: &'static str,
    subject_id: i64,
    topic_id: i64,
    color: String,
    items: Vec<&'a SrsRow>,
}

/// Deliverable 2 — Lógica Rust (Transformação de Dados): converte as linhas do banco
/// em série temporal multichave. Cada linha de saída é { day, date, "<matéria>": %, ... }.
pub fn retention_overview(connection: &Connection, horizon_days: Option<i64>) -> SqlResult<RetentionOverview> {
    let horizon = horizon_days.unwrap_or(60).clamp(7, 180);
    let groups = retention_group_snapshot(connection)?;

    let mut statement = connection.prepare(&format!(
        "{SRS_JOIN_SELECT} WHERE si.user_id = ?1 ORDER BY si.id ASC"
    ))?;
    let rows: Vec<SrsRow> = statement
        .query_map(params![DEFAULT_USER_ID], srs_row_from_row)?
        .collect::<SqlResult<Vec<_>>>()?;

    let today = today_iso();
    let start = parse_date(&today);

    // Global (visão agregada): sempre existe; itens vazios → série vazia.
    let mut builders: Vec<RetentionSeriesBuilder<'_>> = Vec::new();
    builders.push(RetentionSeriesBuilder {
        key: "Média Geral".to_string(),
        name: "Média Geral".to_string(),
        level: "global",
        subject_id: 0,
        topic_id: 0,
        color: "#94a3b8".to_string(),
        items: rows.iter().collect(),
    });

    // Matéria (nível macro).
    let mut subjects: Vec<(i64, String, String)> = Vec::new();
    for g in &groups {
        if g.subject_id != 0 && !subjects.iter().any(|(id, _, _)| *id == g.subject_id) {
            subjects.push((g.subject_id, g.subject_name.clone(), g.subject_color.clone()));
        }
    }
    subjects.sort_by(|a, b| a.1.to_lowercase().cmp(&b.1.to_lowercase()));
    for (index, (subject_id, name, color)) in subjects.iter().enumerate() {
        let subject_items: Vec<&SrsRow> = rows
            .iter()
            .filter(|row| row.subject_id == Some(*subject_id))
            .collect();
        if subject_items.is_empty() {
            continue;
        }
        let base = hex_for(color);
        let distinct = PALETTE[index % PALETTE.len()];
        builders.push(RetentionSeriesBuilder {
            key: name.clone(),
            name: name.clone(),
            level: "subject",
            subject_id: *subject_id,
            topic_id: 0,
            color: if base == "#94a3b8" { distinct.to_string() } else { base },
            items: subject_items,
        });
    }

    // Nicho (nível micro: matéria › tópico).
    let mut topics: Vec<RetentionGroupRecord> = groups
        .iter()
        .filter(|g| g.topic_id != 0 || g.topic_name != "Sem nicho")
        .cloned()
        .collect();
    topics.sort_by(|a, b| {
        a.subject_name
            .to_lowercase()
            .cmp(&b.subject_name.to_lowercase())
            .then(a.topic_name.to_lowercase().cmp(&b.topic_name.to_lowercase()))
    });
    for (index, g) in topics.iter().enumerate() {
        let niche_items: Vec<&SrsRow> = rows
            .iter()
            .filter(|row| {
                row.subject_id == Some(g.subject_id)
                    && row.topic_id == Some(g.topic_id)
            })
            .collect();
        if niche_items.is_empty() {
            continue;
        }
        let parent = builders
            .iter()
            .find(|b| b.level == "subject" && b.subject_id == g.subject_id)
            .map(|b| b.color.clone())
            .unwrap_or_else(|| PALETTE[index % PALETTE.len()].to_string());
        let shift = PALETTE[(index + 2) % PALETTE.len()];
        let key = format!("{} › {}", g.subject_name, g.topic_name);
        builders.push(RetentionSeriesBuilder {
            name: key.clone(),
            key,
            level: "topic",
            subject_id: g.subject_id,
            topic_id: g.topic_id,
            color: if parent == shift { PALETTE[(index + 3) % PALETTE.len()].to_string() } else { shift.to_string() },
            items: niche_items,
        });
    }

    let series: Vec<RetentionSeriesInfo> = builders
        .iter()
        .filter(|b| !b.items.is_empty())
        .map(|b| {
            let items = b.items.len() as i64;
            let avg_stability = b.items.iter().map(|row| row.stability).sum::<f64>() / items as f64;
            let retrievability_today = (b
                .items
                .iter()
                .map(|row| {
                    calculate_retrievability(
                        row.stability,
                        days_since(&row.last_review_date, &today),
                    )
                })
                .sum::<f64>()
                / items as f64)
                * 100.0;
            let due_in_days = b
                .items
                .iter()
                .map(|row| {
                    let elapsed = days_since(&row.last_review_date, &today);
                    let optimal = row.stability.round().max(1.0) as f64;
                    (optimal - elapsed).ceil().max(0.0) as i64
                })
                .min()
                .unwrap_or(0);
            RetentionSeriesInfo {
                key: b.key.clone(),
                name: b.name.clone(),
                level: b.level.to_string(),
                subject_id: b.subject_id,
                topic_id: b.topic_id,
                color: b.color.clone(),
                items,
                avg_stability: round1(avg_stability),
                retrievability_today: round1(retrievability_today.max(0.0).min(100.0)),
                due_in_days,
            }
        })
        .collect();

    let mut rows_out: Vec<serde_json::Value> = Vec::with_capacity(horizon as usize + 1);
    for day in 0..=horizon {
        let mut object = serde_json::Map::new();
        object.insert("day".to_string(), serde_json::json!(day));
        object.insert(
            "date".to_string(),
            serde_json::json!((start + chrono::Duration::days(day)).to_string()),
        );
        for b in builders.iter().filter(|b| !b.items.is_empty()) {
            let total = b.items.iter().map(|row| {
                let elapsed = days_since(&row.last_review_date, &today);
                calculate_retrievability(row.stability, day as f64 + elapsed as f64)
            });
            let mean = total.sum::<f64>() / b.items.len() as f64;
            object.insert(b.key.clone(), serde_json::json!(round1(mean * 100.0)));
        }
        rows_out.push(serde_json::Value::Object(object));
    }

    Ok(RetentionOverview {
        generated_date: today,
        horizon_days: horizon,
        series,
        rows: rows_out,
    })
}

/* ---------------------------------------------------------------- */
/* API de desempenho — livestream de retenção + relatório consolidado */
/* ---------------------------------------------------------------- */

const MANY_PARTIALS_THRESHOLD: i64 = 3;
const LIVESTREAM_HORIZON_MINUTES: i64 = 90;
const REPORT_HORIZON_DAYS: i64 = 60;

/// { subject_id: (questions_total, questions_correct) } por matéria.
fn question_stats_by_subject(connection: &Connection) -> SqlResult<HashMap<i64, (i64, i64)>> {
    let mut statement = connection.prepare(
        "SELECT subject_id,
                SUM(questions_total) AS total,
                SUM(questions_correct) AS correct
         FROM question_results
         WHERE user_id = ?1
         GROUP BY subject_id",
    )?;
    let mut result = HashMap::new();
    let mut query = statement.query(params![DEFAULT_USER_ID])?;
    while let Some(row) = query.next()? {
        let subject_id: i64 = row.get(0)?;
        let total: i64 = row.get(1)?;
        let correct: i64 = row.get(2)?;
        result.insert(subject_id, (total, correct));
    }
    Ok(result)
}

/// { subject_id: (blocos_concluidos, blocos_parciais) } por matéria.
fn focus_blocks_by_subject(connection: &Connection) -> SqlResult<HashMap<i64, (i64, i64)>> {
    let mut statement = connection.prepare(
        "SELECT subject_id,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS deep_blocks,
                SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial_blocks
         FROM focus_sessions
         WHERE user_id = ?1
         GROUP BY subject_id",
    )?;
    let mut result = HashMap::new();
    let mut query = statement.query(params![DEFAULT_USER_ID])?;
    while let Some(row) = query.next()? {
        let subject_id: i64 = row.get(0)?;
        result.insert(subject_id, (row.get(1)?, row.get(2)?));
    }
    Ok(result)
}

fn memory_items_all(connection: &Connection) -> SqlResult<Vec<SrsRow>> {
    let mut statement = connection.prepare(&format!(
        "{SRS_JOIN_SELECT} WHERE si.user_id = ?1 ORDER BY si.id ASC"
    ))?;
    statement
        .query_map(params![DEFAULT_USER_ID], srs_row_from_row)?
        .collect::<SqlResult<Vec<_>>>()
}

/// Livestream de retenção — amostra em tempo real por matéria (Retenção · livestream).
/// Acurácia vem do histórico de questões; a variação de retenção vem da projeção FSRS
/// dos próximos 3 dias; `overdue` sinaliza itens vencidos com retenção abaixo do piso;
/// `manyPartials` (>= 3 blocos parciais) dispara o aviso vermelho no painel.
pub fn performance_livestream(connection: &Connection) -> SqlResult<PerformanceLiveStream> {
    let today = today_iso();
    let subjects = list_subjects(connection)?;
    let items = memory_items_all(connection)?;
    let question_by = question_stats_by_subject(connection)?;
    let focus_by = focus_blocks_by_subject(connection)?;

    let ticks = subjects
        .iter()
        .map(|subject| {
            let subject_items: Vec<&SrsRow> = items
                .iter()
                .filter(|row| row.subject_id == Some(subject.id))
                .collect();
            let count = subject_items.len().max(1);
            let retrievability_today = subject_items
                .iter()
                .map(|row| {
                    calculate_retrievability(row.stability, days_since(&row.last_review_date, &today))
                })
                .sum::<f64>()
                / count as f64
                * 100.0;
            let retrievability_ahead = subject_items
                .iter()
                .map(|row| {
                    calculate_retrievability(
                        row.stability,
                        days_since(&row.last_review_date, &today) + 3.0,
                    )
                })
                .sum::<f64>()
                / count as f64
                * 100.0;
            let (total, correct) = question_by.get(&subject.id).copied().unwrap_or((0, 0));
            let accuracy = if total > 0 { percentage(correct, total) } else { 70.0 };
            let partials = focus_by
                .get(&subject.id)
                .map(|(_, partial)| *partial)
                .unwrap_or(0);
            let overdue = !subject_items.is_empty()
                && subject_items
                    .iter()
                    .any(|row| days_since(&row.last_review_date, &today) > row.stability)
                && retrievability_today < 70.0;
            PerformanceLiveTick {
                subject_id: subject.id,
                subject_name: subject.name.clone(),
                color: subject.color.clone(),
                accuracy: round1(accuracy),
                retention_delta: round1(retrievability_today - retrievability_ahead),
                overdue,
                many_partials: partials >= MANY_PARTIALS_THRESHOLD,
            }
        })
        .collect();

    Ok(PerformanceLiveStream {
        generated_at: chrono::Local::now().format("%Y-%m-%dT%H:%M").to_string(),
        horizon_minutes: LIVESTREAM_HORIZON_MINUTES,
        ticks,
    })
}

/// Relatório consolidado de desempenho — cruzamento de ranking, acurácia, retenção
/// (FSRS) e foco (blocos profundos × parciais), com totais gerais do período.
pub fn consolidated_performance_report(
    connection: &Connection,
) -> SqlResult<ConsolidatedPerformanceReport> {
    let today = today_iso();
    let subjects = list_subjects(connection)?;
    let items = memory_items_all(connection)?;
    let question_by = question_stats_by_subject(connection)?;
    let focus_by = focus_blocks_by_subject(connection)?;
    let ranking = priority_ranking(connection)?;
    let rank_by: HashMap<i64, i64> = ranking
        .iter()
        .map(|entry| (entry.subject.id, entry.rank))
        .collect();

    let mut rows: Vec<ConsolidatedPerformanceRow> = Vec::with_capacity(subjects.len());
    for subject in &subjects {
        let subject_items: Vec<&SrsRow> = items
            .iter()
            .filter(|row| row.subject_id == Some(subject.id))
            .collect();
        let count = subject_items.len().max(1);
        let retrievability_today = subject_items
            .iter()
            .map(|row| {
                calculate_retrievability(row.stability, days_since(&row.last_review_date, &today))
            })
            .sum::<f64>()
            / count as f64
            * 100.0;
        let mut earliest_due = 0_i64;
        let mut overdue_items = 0_i64;
        for row in &subject_items {
            let elapsed = days_since(&row.last_review_date, &today);
            let optimal = row.stability.round().max(1.0) as f64;
            let due = (optimal - elapsed).ceil() as i64;
            if earliest_due == 0 || due < earliest_due {
                earliest_due = due;
            }
            if elapsed > row.stability {
                overdue_items += 1;
            }
        }
        let (total, correct) = question_by.get(&subject.id).copied().unwrap_or((0, 0));
        let accuracy = if total > 0 { percentage(correct, total) } else { 0.0 };
        let (deep_blocks, partials) = focus_by.get(&subject.id).copied().unwrap_or((0, 0));
        let floor = (100.0 - subject.difficulty as f64 * 8.0).max(50.0);
        rows.push(ConsolidatedPerformanceRow {
            subject_id: subject.id,
            subject_name: subject.name.clone(),
            color: subject.color.clone(),
            rank: rank_by.get(&subject.id).copied().unwrap_or(0),
            accuracy: round1(accuracy),
            questions_total: total,
            questions_correct: correct,
            retention_today: round1(retrievability_today.max(0.0).min(100.0)),
            due_in_days: earliest_due,
            overdue_items,
            deep_work_blocks: deep_blocks,
            partial_blocks: partials,
            has_many_partials: partials >= MANY_PARTIALS_THRESHOLD,
            is_overdue: overdue_items > 0 || accuracy < floor,
        });
    }
    rows.sort_by(|a, b| a.rank.cmp(&b.rank));

    let questions_total = rows.iter().map(|row| row.questions_total).sum::<i64>();
    let questions_correct = rows.iter().map(|row| row.questions_correct).sum::<i64>();
    let totals = ConsolidatedPerformanceTotals {
        questions_total,
        questions_correct,
        accuracy: if questions_total > 0 {
            percentage(questions_correct, questions_total)
        } else {
            0.0
        },
        deep_work_blocks: rows.iter().map(|row| row.deep_work_blocks).sum(),
        partial_blocks: rows.iter().map(|row| row.partial_blocks).sum(),
        overdue_items: rows.iter().map(|row| row.overdue_items).sum(),
        subjects_late: rows.iter().filter(|row| row.is_overdue).count() as i64,
    };

    Ok(ConsolidatedPerformanceReport {
        generated_at: today,
        horizon_days: REPORT_HORIZON_DAYS,
        ranking: rows,
        totals,
    })
}

/* ---------------------------------------------------------------- */
/* Curvas de retenção FSRS                                           */
/* ---------------------------------------------------------------- */

/// Recria a estabilidade "melhor estado" de um item a partir do histórico de
/// revisões gravado em `fsrs_reviews`. Revisões futuras (data > hoje) são
/// ignoradas; revisões "again" não ascendem a estabilidade (voltam ao valor
/// anterior). Sem histórico, cai de volta para a estabilidade atual do item.
fn stability_from_reviews(connection: &Connection, item_id: i64, fallback: f64) -> SqlResult<f64> {
    let today = today_iso();
    let mut statement = connection.prepare(
        "SELECT stability_before, stability_after, grade, reviewed_at
         FROM fsrs_reviews WHERE item_id = ?1 ORDER BY reviewed_at ASC, id ASC",
    )?;
    let rows: Vec<(f64, f64, String, String)> = statement
        .query_map(params![item_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?
        .collect::<SqlResult<Vec<_>>>()?;
    if rows.is_empty() {
        return Ok(fallback);
    }
    let mut best_stability = 0.0f64;
    for (before, after, grade, reviewed_at) in &rows {
        if reviewed_at.as_str() > today.as_str() {
            continue;
        }
        let candidate = if grade.as_str() == "again" {
            before.max(0.0)
        } else {
            after.max(*before)
        };
        best_stability = best_stability.max(candidate);
    }
    if best_stability <= 0.0 {
        return Ok(fallback);
    }
    Ok(best_stability)
}

/// Gera a curva física R(t) = (1 + t/(9S))⁻¹ a partir de hoje, com a linha
/// de alerta em 90%. `crosses_at_day` = primeiro dia em que R ≤ 90% (0 = já
/// cruzou hoje; None = não cruza dentro do horizonte).
fn curve_from_stability(stability: f64, elapsed_today: f64, horizon: i64) -> RetentionCurve {
    let mut points = Vec::with_capacity(horizon as usize + 1);
    let mut crossed_at: Option<i64> = None;
    for day in 0..=horizon {
        let retrievability = calculate_retrievability(stability, elapsed_today + day as f64) * 100.0;
        if crossed_at.is_none() && retrievability <= 90.0 {
            crossed_at = Some(day);
        }
        points.push(RetentionCurvePoint {
            x: day,
            y: round1(retrievability.clamp(0.0, 100.0)),
        });
    }
    RetentionCurve {
        points,
        crosses_at_day: crossed_at,
    }
}

/// Curva de retenção de um item específico (backend calcula; o frontend apenas
/// desenha). Retorna `None` se o item não existe.
pub fn retention_curve_for_item(
    connection: &Connection,
    item_id: i64,
    horizon_days: Option<i64>,
) -> SqlResult<Option<RetentionCurve>> {
    let raw = match memory_item_raw_by_id(connection, item_id) {
        Ok(raw) => raw,
        Err(_) => return Ok(None),
    };
    let stability = stability_from_reviews(connection, item_id, raw.stability)?;
    let elapsed_today = days_since(&raw.last_review_date, &today_iso());
    let horizon = horizon_days.unwrap_or(90).clamp(7, 365);
    Ok(Some(curve_from_stability(stability, elapsed_today, horizon)))
}

/// Curva global: média diária de R(t) sobre todos os itens do usuário.
pub fn retention_curve_global(
    connection: &Connection,
    horizon_days: Option<i64>,
) -> SqlResult<RetentionCurve> {
    let horizon = horizon_days.unwrap_or(90).clamp(7, 365);
    let mut statement = connection.prepare(&format!(
        "{SRS_JOIN_SELECT} WHERE si.user_id = ?1 ORDER BY si.id ASC"
    ))?;
    let rows: Vec<SrsRow> = statement
        .query_map(params![DEFAULT_USER_ID], srs_row_from_row)?
        .collect::<SqlResult<Vec<_>>>()?;
    if rows.is_empty() {
        return Ok(RetentionCurve {
            points: Vec::new(),
            crosses_at_day: None,
        });
    }
    let today = today_iso();
    let mut points = Vec::with_capacity(horizon as usize + 1);
    let mut crossed_at: Option<i64> = None;
    for day in 0..=horizon {
        let mean: f64 = rows
            .iter()
            .map(|row| {
                let elapsed = days_since(&row.last_review_date, &today);
                calculate_retrievability(row.stability, elapsed + day as f64)
            })
            .sum::<f64>()
            / rows.len() as f64;
        let percent = mean * 100.0;
        if crossed_at.is_none() && percent <= 90.0 {
            crossed_at = Some(day);
        }
        points.push(RetentionCurvePoint {
            x: day,
            y: round1(percent.clamp(0.0, 100.0)),
        });
    }
    Ok(RetentionCurve {
        points,
        crosses_at_day: crossed_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_connection() -> Connection {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.pragma_update(None, "foreign_keys", "ON").unwrap();
        connection.execute_batch(SCHEMA).unwrap();
        migrate(&connection).unwrap();
        seed(&mut connection).unwrap();
        connection
    }

    /// PASSO 4 — atomicidade: uma gravação que falha no meio não deixa
    /// registros parciais; toda a transação é revertida.
    #[test]
    fn run_write_rolls_back_partial_writes_on_failure() {
        let mut connection = memory_connection();
        let before: i64 = connection
            .query_row("SELECT COUNT(*) FROM subjects", [], |row| row.get(0))
            .unwrap();
        assert!(before > 0, "seed deve fornecer linhas para o teste");

        let result = run_write(&mut connection, |connection| {
            // 1ª gravação: válida (mas deve ser revertida junto).
            connection.execute(
                "INSERT INTO focus_sessions (user_id, subject_id, planned_minutes, elapsed_minutes, started_at)
                 VALUES (1, 1, 25, 25, '2026-09-19')",
                [],
            )?;
            // 2ª gravação: viola CHECK(planned_minutes > 0) → transação aborta.
            connection.execute(
                "INSERT INTO focus_sessions (user_id, subject_id, planned_minutes, started_at)
                 VALUES (1, 1, -5, '2026-09-19')",
                [],
            )?;
            Ok(())
        });
        assert!(result.is_err(), "esperava erro por violação de CHECK");

        let after: i64 = connection
            .query_row("SELECT COUNT(*) FROM subjects", [], |row| row.get(0))
            .unwrap();
        assert_eq!(before, after, "rollback deve restaurar o estado original");
        let focus_rows: i64 = connection
            .query_row("SELECT COUNT(*) FROM focus_sessions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(focus_rows, 0, "nenhuma gravação parcial pode sobreviver");
    }

    /// A transação é confirmada apenas quando todas as gravações têm sucesso.
    #[test]
    fn run_write_commits_when_everything_succeeds() {
        let mut connection = memory_connection();
        run_write(&mut connection, |connection| {
            connection.execute(
                "INSERT INTO focus_sessions (user_id, subject_id, goal_type, planned_minutes, elapsed_minutes, started_at)
                 VALUES (1, 1, 'paginas', 50, 50, '2026-09-19')",
                [],
            )?;
            connection.execute(
                "INSERT INTO focus_sessions (user_id, subject_id, goal_type, planned_minutes, elapsed_minutes, started_at)
                 VALUES (1, 1, 'paginas', 25, 20, '2026-09-20')",
                [],
            )?;
            Ok(())
        })
        .unwrap();
        let focus_rows: i64 = connection
            .query_row("SELECT COUNT(*) FROM focus_sessions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(focus_rows, 2);
    }

    /// Sub-áreas da mesma matéria permanecem em bloco (ordem do catálogo),
    /// e o pico de risco comanda a ordem dos grupos.
    #[test]
    fn sequence_by_parent_groups_subareas_keeps_catalog_order() {
        let input = vec![
            (1, "Matemática · Álgebra".to_string(), "red".to_string(), 40),
            (2, "Matemática · Geometria".to_string(), "red".to_string(), 60),
            (3, "Física · Mecânica".to_string(), "blue".to_string(), 90),
            (4, "Biologia Ensino Médio".to_string(), "green".to_string(), 5),
        ];
        let ordered = sequence_by_parent(input);
        let names: Vec<&str> = ordered.iter().map(|row| row.1.as_str()).collect();
        assert_eq!(
            names,
            vec![
                "Física · Mecânica",
                "Matemática · Álgebra",
                "Matemática · Geometria",
                "Biologia Ensino Médio"
            ]
        );
    }
}
