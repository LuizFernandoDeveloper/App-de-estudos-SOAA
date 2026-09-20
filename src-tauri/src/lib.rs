mod database;
mod models;
mod scheduler;

use std::{fs, sync::Arc};

use chrono::Local;
use database::AppState;
use models::{
    BrainDumpLog, BrainDumpLogInput, BufferAllocation, ConsolidatedPerformanceReport,
    DashboardData, DayAllocation, DayAllocationInput, FocusOverloadPoint, FocusSession,
    FocusSessionInput, FsrsReview, LearningSpeed, MaterialInput, MaterialStrategy,
    MemoryDecayProjection, MemoryItemInput, PerformanceLiveStream, PerformancePoint, PlanInput,
    PlanResponse, Profile, ProfileInput, QuestionResult, QuestionResultInput, ReschedulePlan,
    RetentionCurve, RetentionOverview, ScheduleResponse, SessionSummary, SpacedRepetitionItem,
    StudyMaterial, Subject, SubjectAccuracyPoint, SubjectGoalInput, SubjectInput, SubjectRanking,
    TimeboxSuggestion, Topic, TopicInput,
};
use tauri::Manager;

type CommandResult<T> = Result<T, String>;

/// Executa a operação de banco em uma thread de bloqueio (fora do loop async),
/// mantendo o runtime do Tauri sempre responsivo. O estado é compartilhado por
/// `Arc`, e a conexão fica protegida por um único `Mutex` global.
async fn with_connection<T, F>(
    state: tauri::State<'_, Arc<AppState>>,
    operation: F,
) -> CommandResult<T>
where
    T: Send + 'static,
    F: FnOnce(&mut rusqlite::Connection) -> CommandResult<T> + Send + 'static,
{
    let app_state = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = app_state.connection.lock().map_err(|_| {
            "Não foi possível acessar o banco local.".to_string()
        })?;
        operation(&mut connection)
    })
    .await
    .map_err(|error| format!("Falha ao executar a operação no banco: {error}"))?
}

fn validate_subject(input: &SubjectInput) -> CommandResult<(String, String)> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("O nome da matéria é obrigatório.".into());
    }
    if !(1..=5).contains(&input.weight) || !(1..=5).contains(&input.difficulty) {
        return Err("Peso estratégico e dificuldade devem ficar entre 1 e 5.".into());
    }
    let color = input.color.as_deref().unwrap_or("blue").trim();
    Ok((name.to_string(), if color.is_empty() { "blue".into() } else { color.into() }))
}

fn validate_profile(input: &ProfileInput) -> CommandResult<()> {
    if !input.daily_hours.is_finite() || input.daily_hours <= 0.0 || input.daily_hours > 24.0 {
        return Err("A carga diária deve estar entre 0,1 e 24 horas.".into());
    }
    if !(1..=7).contains(&input.weekly_days) {
        return Err("A quantidade de dias da semana deve estar entre 1 e 7.".into());
    }
    if input.exam_track.trim().is_empty() {
        return Err("Selecione uma trilha de estudo.".into());
    }
    if input.study_days.is_empty() || input.study_days.len() as i64 != input.weekly_days {
        return Err("A quantidade de dias selecionados deve ser igual aos dias de estudo da semana.".into());
    }
    if !input.study_days.iter().all(|day| (0..=6).contains(day)) {
        return Err("Dia de estudo inválido (use 0=Segunda … 6=Domingo).".into());
    }
    let mut unique = input.study_days.clone();
    unique.sort_unstable();
    unique.dedup();
    if unique.len() != input.study_days.len() {
        return Err("Dias de estudo duplicados.".into());
    }
    Ok(())
}

fn validate_material(input: &MaterialInput) -> CommandResult<()> {
    if input.title.trim().is_empty() || input.category.trim().is_empty() {
        return Err("Título e categoria do material são obrigatórios.".into());
    }
    if !["pendente", "em_andamento", "concluido"].contains(&input.status.as_str()) {
        return Err("Status de material inválido.".into());
    }
    if input.current_page < 0 || input.total_pages < 0 || input.current_page > input.total_pages.max(1) {
        return Err("As páginas devem ser válidas (atual entre 0 e o total).".into());
    }
    Ok(())
}

fn validate_topic(input: &TopicInput) -> CommandResult<String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("O nome do tópico é obrigatório.".into());
    }
    if !["pendente", "em_andamento", "concluido"].contains(&input.status.as_str()) {
        return Err("Status de tópico inválido.".into());
    }
    Ok(name.to_string())
}

fn validate_goals(input: &SubjectGoalInput) -> CommandResult<()> {
    if !(0..=100).contains(&input.goal_accuracy) || !(0..=100).contains(&input.goal_coverage) {
        return Err("As metas de avanço devem ficar entre 0% e 100%.".into());
    }
    Ok(())
}

fn validate_focus_input(input: &FocusSessionInput) -> CommandResult<()> {
    if !["paginas", "topicos", "exercicios"].contains(&input.goal_type.as_str()) {
        return Err("O tipo de meta deve ser páginas, tópicos ou exercícios.".into());
    }
    if input.planned_minutes <= 0 || planned_limits(input.planned_minutes) {
        return Err("O tempo planejado do bloco deve estar entre 1 e 240 minutos.".into());
    }
    if input.elapsed_minutes < 0 || input.elapsed_minutes > 600 {
        return Err("O tempo executado informado é inválido.".into());
    }
    if input.interrupts < 0 {
        return Err("O número de interrupções não pode ser negativo.".into());
    }
    if let Some(reason) = &input.exit_reason {
        if !["fadiga_metabolica", "distracao_externa", "dificuldade_materia", "meta_concluida"]
            .contains(&reason.as_str())
        {
            return Err("O motivo de saída precoce é inválido.".into());
        }
    }
    if let Some(value) = input.completion_percentage {
        if !(0.0..=100.0).contains(&value) {
            return Err("O percentual de domínio deve ficar entre 0% e 100%.".into());
        }
    }
    if input.started_at.trim().is_empty() {
        return Err("Informe quando a sessão foi iniciada.".into());
    }
    if let (Some(start), Some(end)) = (input.page_start, input.page_end) {
        if start < 0 || end < start || end > 100_000 {
            return Err("O intervalo de páginas é inválido.".into());
        }
    }
    Ok(())
}

fn planned_limits(minutes: i64) -> bool {
    !(1..=240).contains(&minutes)
}

fn validate_memory_item(input: &MemoryItemInput) -> CommandResult<String> {
    let concept = input.concept.trim();
    if concept.is_empty() {
        return Err("O nome do item a revisar é obrigatório.".into());
    }
    if !input.difficulty.is_finite() || !(1.0..=10.0).contains(&input.difficulty) {
        return Err("A dificuldade do item deve ficar entre 1 e 10.".into());
    }
    Ok(concept.to_string())
}

#[tauri::command]
async fn list_subjects(state: tauri::State<'_, Arc<AppState>>) -> CommandResult<Vec<Subject>> {
    with_connection(state, |connection| {
        database::list_subjects(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn create_subject(
    state: tauri::State<'_, Arc<AppState>>,
    input: SubjectInput,
) -> CommandResult<Subject> {
    let (name, color) = validate_subject(&input)?;
    with_connection(state, move |connection| {
        database::insert_subject(
            connection,
            &name,
            input.weight,
            input.difficulty,
            &color,
            input.current_level.unwrap_or(1),
            input.target_level.unwrap_or(4),
        )
        .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn update_subject(
    state: tauri::State<'_, Arc<AppState>>,
    id: i64,
    input: SubjectInput,
) -> CommandResult<Subject> {
    let (name, color) = validate_subject(&input)?;
    with_connection(state, move |connection| {
        database::update_subject(
            connection,
            id,
            &name,
            input.weight,
            input.difficulty,
            &color,
            input.current_level.unwrap_or(1),
            input.target_level.unwrap_or(4),
        )
        .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn delete_subject(state: tauri::State<'_, Arc<AppState>>, id: i64) -> CommandResult<()> {
    with_connection(state, move |connection| {
        if database::delete_subject(connection, id).map_err(|error| error.to_string())? {
            Ok(())
        } else {
            Err("Matéria não encontrada.".into())
        }
    })
    .await
}

#[tauri::command]
async fn update_subject_goals(
    state: tauri::State<'_, Arc<AppState>>,
    id: i64,
    input: SubjectGoalInput,
) -> CommandResult<Subject> {
    validate_goals(&input)?;
    with_connection(state, move |connection| {
        database::update_subject_goals(connection, id, input.goal_accuracy, input.goal_coverage)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_topics(state: tauri::State<'_, Arc<AppState>>) -> CommandResult<Vec<Topic>> {
    with_connection(state, |connection| {
        database::list_topics(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn create_topic(
    state: tauri::State<'_, Arc<AppState>>,
    input: TopicInput,
) -> CommandResult<Topic> {
    let name = validate_topic(&input)?;
    with_connection(state, move |connection| {
        database::insert_topic(connection, input.subject_id, &name, &input.status)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn update_topic(
    state: tauri::State<'_, Arc<AppState>>,
    id: i64,
    input: TopicInput,
) -> CommandResult<Topic> {
    let name = validate_topic(&input)?;
    with_connection(state, move |connection| {
        database::update_topic(connection, id, input.subject_id, &name, &input.status)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn delete_topic(state: tauri::State<'_, Arc<AppState>>, id: i64) -> CommandResult<()> {
    with_connection(state, move |connection| {
        if database::delete_topic(connection, id).map_err(|error| error.to_string())? {
            Ok(())
        } else {
            Err("Tópico não encontrado.".into())
        }
    })
    .await
}

#[tauri::command]
async fn update_material_page(
    state: tauri::State<'_, Arc<AppState>>,
    id: i64,
    current_page: i64,
) -> CommandResult<StudyMaterial> {
    if current_page < 0 {
        return Err("A página atual não pode ser negativa.".into());
    }
    with_connection(state, move |connection| {
        database::update_material_page(connection, id, current_page)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_profile(state: tauri::State<'_, Arc<AppState>>) -> CommandResult<Profile> {
    with_connection(state, |connection| {
        database::get_profile(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn update_profile(
    state: tauri::State<'_, Arc<AppState>>,
    input: ProfileInput,
) -> CommandResult<Profile> {
    validate_profile(&input)?;
    with_connection(state, move |connection| {
        database::update_profile(connection, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn calculate_schedule(
    state: tauri::State<'_, Arc<AppState>>,
    total_hours: f64,
) -> CommandResult<ScheduleResponse> {
    let subjects = with_connection(state, |connection| {
        database::list_subjects(connection).map_err(|error| error.to_string())
    })
    .await?;
    scheduler::calculate_schedule(&subjects, total_hours)
}

#[tauri::command]
async fn save_daily_log(
    state: tauri::State<'_, Arc<AppState>>,
    total_hours: f64,
    allocation_data: serde_json::Value,
) -> CommandResult<()> {
    if !total_hours.is_finite() || total_hours <= 0.0 || total_hours > 24.0 {
        return Err("A carga diária para o registro é inválida.".into());
    }
    let allocation_json = serde_json::to_string(&allocation_data).map_err(|error| error.to_string())?;
    let date = Local::now().date_naive().to_string();
    with_connection(state, move |connection| {
        database::save_daily_log(connection, &date, total_hours, &allocation_json)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_materials(state: tauri::State<'_, Arc<AppState>>) -> CommandResult<Vec<StudyMaterial>> {
    with_connection(state, |connection| {
        database::list_materials(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn create_material(
    state: tauri::State<'_, Arc<AppState>>,
    input: MaterialInput,
) -> CommandResult<StudyMaterial> {
    validate_material(&input)?;
    with_connection(state, move |connection| {
        database::insert_material(connection, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn update_material(
    state: tauri::State<'_, Arc<AppState>>,
    id: i64,
    input: MaterialInput,
) -> CommandResult<StudyMaterial> {
    validate_material(&input)?;
    with_connection(state, move |connection| {
        database::update_material(connection, id, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn delete_material(state: tauri::State<'_, Arc<AppState>>, id: i64) -> CommandResult<()> {
    with_connection(state, move |connection| {
        if database::delete_material(connection, id).map_err(|error| error.to_string())? {
            Ok(())
        } else {
            Err("Material não encontrado.".into())
        }
    })
    .await
}

#[tauri::command]
async fn record_question_result(
    state: tauri::State<'_, Arc<AppState>>,
    input: QuestionResultInput,
) -> CommandResult<QuestionResult> {
    if input.date.trim().is_empty() || input.questions_total <= 0 || input.questions_correct < 0
        || input.questions_correct > input.questions_total || input.studied_minutes < 0 {
        return Err("Revise o lançamento de questões: acertos, total e tempo devem ser válidos.".into());
    }
    with_connection(state, move |connection| {
        database::insert_question_result(connection, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_dashboard(state: tauri::State<'_, Arc<AppState>>) -> CommandResult<DashboardData> {
    with_connection(state, |connection| {
        database::dashboard(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_priority_ranking(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<SubjectRanking>> {
    with_connection(state, |connection| {
        database::priority_ranking(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn performance_trend(
    state: tauri::State<'_, Arc<AppState>>,
    granularity: String,
    subject_id: Option<i64>,
    topic_id: Option<i64>,
) -> CommandResult<Vec<PerformancePoint>> {
    with_connection(state, move |connection| {
        database::performance_trend(connection, &granularity, subject_id, topic_id)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_subject_accuracy_trend(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<SubjectAccuracyPoint>> {
    with_connection(state, |connection| {
        database::subject_accuracy_trend(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_focus_overload_trend(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<FocusOverloadPoint>> {
    with_connection(state, |connection| {
        database::focus_overload_trend(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_day_allocations(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<DayAllocation>> {
    with_connection(state, |connection| {
        database::list_day_allocations(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn save_day_allocation(
    state: tauri::State<'_, Arc<AppState>>,
    input: DayAllocationInput,
) -> CommandResult<Vec<DayAllocation>> {
    if !(0..=6).contains(&input.weekday) {
        return Err("Selecione um dia da semana válido para o reforço.".into());
    }
    if !(1..=600).contains(&input.minutes) {
        return Err("O tempo do bloco deve ficar entre 1 e 600 minutos.".into());
    }
    with_connection(state, move |connection| {
        database::save_day_allocation(connection, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn delete_day_allocation(
    state: tauri::State<'_, Arc<AppState>>,
    subject_id: i64,
) -> CommandResult<Vec<DayAllocation>> {
    with_connection(state, move |connection| {
        database::delete_day_allocation(connection, subject_id).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_focus_sessions(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<FocusSession>> {
    with_connection(state, |connection| {
        database::list_focus_sessions(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn complete_focus_session(
    state: tauri::State<'_, Arc<AppState>>,
    input: FocusSessionInput,
) -> CommandResult<SessionSummary> {
    validate_focus_input(&input)?;
    with_connection(state, move |connection| {
        database::complete_focus_session(connection, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_focus_timebox(
    state: tauri::State<'_, Arc<AppState>>,
    subject_id: i64,
) -> CommandResult<TimeboxSuggestion> {
    with_connection(state, move |connection| {
        database::suggest_focus_timebox(connection, subject_id).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn log_brain_dump(
    state: tauri::State<'_, Arc<AppState>>,
    input: BrainDumpLogInput,
) -> CommandResult<BrainDumpLog> {
    if input.note.trim().is_empty() {
        return Err("A captura externa não pode ser vazia.".into());
    }
    with_connection(state, move |connection| {
        database::log_brain_dump(connection, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_brain_dumps(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<BrainDumpLog>> {
    with_connection(state, |connection| {
        database::list_brain_dumps(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_learning_speed(
    state: tauri::State<'_, Arc<AppState>>,
    subject_id: Option<i64>,
) -> CommandResult<Vec<LearningSpeed>> {
    with_connection(state, move |connection| {
        database::learning_speed(connection, subject_id).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_study_plan(
    state: tauri::State<'_, Arc<AppState>>,
    input: PlanInput,
) -> CommandResult<PlanResponse> {
    with_connection(state, move |connection| {
        database::generate_study_plan(connection, &input).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_material_strategies(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<MaterialStrategy>> {
    with_connection(state, |connection| {
        database::list_material_strategies(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn reschedule_buffer(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<ReschedulePlan> {
    with_connection(state, |connection| {
        database::reschedule_buffer(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_buffer_allocations(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<BufferAllocation>> {
    with_connection(state, |connection| {
        database::list_buffer_allocations(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_memory_items(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<Vec<SpacedRepetitionItem>> {
    with_connection(state, |connection| {
        database::list_memory_items(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn create_memory_item(
    state: tauri::State<'_, Arc<AppState>>,
    input: MemoryItemInput,
) -> CommandResult<SpacedRepetitionItem> {
    let concept = validate_memory_item(&input)?;
    with_connection(state, move |connection| {
        database::insert_memory_item(
            connection,
            input.subject_id,
            input.topic_id,
            &concept,
            input.difficulty,
        )
        .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn delete_memory_item(state: tauri::State<'_, Arc<AppState>>, id: i64) -> CommandResult<()> {
    with_connection(state, move |connection| {
        if database::delete_memory_item(connection, id).map_err(|error| error.to_string())? {
            Ok(())
        } else {
            Err("Item de memória não encontrado.".into())
        }
    })
    .await
}

#[tauri::command]
async fn review_memory_item(
    state: tauri::State<'_, Arc<AppState>>,
    id: i64,
    grade: String,
) -> CommandResult<SpacedRepetitionItem> {
    if !["again", "hard", "good", "easy"].contains(&grade.as_str()) {
        return Err("Avaliação de revisão inválida: use Errei, Difícil, Bom ou Fácil.".into());
    }
    with_connection(state, move |connection| {
        database::review_memory_item(connection, id, &grade).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_memory_decay(
    state: tauri::State<'_, Arc<AppState>>,
    id: i64,
) -> CommandResult<MemoryDecayProjection> {
    with_connection(state, move |connection| {
        database::memory_decay_projection(connection, id).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn list_fsrs_reviews(
    state: tauri::State<'_, Arc<AppState>>,
    item_id: i64,
) -> CommandResult<Vec<FsrsReview>> {
    with_connection(state, move |connection| {
        database::list_fsrs_reviews_for_item(connection, item_id).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_retention_overview(
    state: tauri::State<'_, Arc<AppState>>,
    horizon_days: Option<i64>,
) -> CommandResult<RetentionOverview> {
    with_connection(state, move |connection| {
        database::retention_overview(connection, horizon_days).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_retention_curve(
    state: tauri::State<'_, Arc<AppState>>,
    item_id: i64,
    horizon_days: Option<i64>,
) -> CommandResult<Option<RetentionCurve>> {
    with_connection(state, move |connection| {
        database::retention_curve_for_item(connection, item_id, horizon_days)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_retention_curve_global(
    state: tauri::State<'_, Arc<AppState>>,
    horizon_days: Option<i64>,
) -> CommandResult<RetentionCurve> {
    with_connection(state, move |connection| {
        database::retention_curve_global(connection, horizon_days)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_performance_livestream(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<PerformanceLiveStream> {
    with_connection(state, |connection| {
        database::performance_livestream(connection).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
async fn get_consolidated_report(
    state: tauri::State<'_, Arc<AppState>>,
) -> CommandResult<ConsolidatedPerformanceReport> {
    with_connection(state, |connection| {
        database::consolidated_performance_report(connection).map_err(|error| error.to_string())
    })
    .await
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let database_path = app_data_dir.join("soaa.db");
            app.manage(Arc::new(AppState::new(&database_path)?));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_subjects,
            create_subject,
            update_subject,
            delete_subject,
            get_profile,
            update_profile,
            calculate_schedule,
            save_daily_log,
            list_materials,
            create_material,
            update_material,
            delete_material,
            record_question_result,
            get_dashboard,
            get_priority_ranking,
            performance_trend,
            get_subject_accuracy_trend,
            update_subject_goals,
            list_topics,
            create_topic,
            update_topic,
            delete_topic,
            update_material_page,
            list_day_allocations,
            save_day_allocation,
            delete_day_allocation,
            list_focus_sessions,
            complete_focus_session,
            get_focus_timebox,
            log_brain_dump,
            list_brain_dumps,
            get_learning_speed,
            get_study_plan,
            list_material_strategies,
            get_focus_overload_trend,
            reschedule_buffer,
            list_buffer_allocations,
            list_memory_items,
            create_memory_item,
            delete_memory_item,
            review_memory_item,
            get_memory_decay,
            list_fsrs_reviews,
            get_retention_overview,
            get_retention_curve,
            get_retention_curve_global,
            get_performance_livestream,
            get_consolidated_report,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo SOAA");
}