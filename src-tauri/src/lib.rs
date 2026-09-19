mod database;
mod models;
mod scheduler;

use std::{fs, sync::MutexGuard};

use chrono::Local;
use database::AppState;
use models::{
    BrainDumpLog, BrainDumpLogInput, BufferAllocation, DashboardData, DayAllocation,
    DayAllocationInput, FocusOverloadPoint, LearningSpeed, MaterialInput, MaterialStrategy,
    MemoryDecayProjection, MemoryItemInput, PerformancePoint, PlanInput, PlanResponse,
    PomodoroSession, PomodoroSessionInput, Profile, ProfileInput, QuestionResult,
    QuestionResultInput, ReschedulePlan, RetentionOverview, ReviewLog, ScheduleResponse,
    SessionSummary, SpacedRepetitionItem, StudyMaterial, Subject, SubjectAccuracyPoint,
    SubjectGoalInput, SubjectInput, SubjectRanking, TimeboxSuggestion, Topic, TopicInput,
};
use tauri::{Manager, State};

type CommandResult<T> = Result<T, String>;

fn locked_connection<'a>(state: &'a State<'_, AppState>) -> CommandResult<MutexGuard<'a, rusqlite::Connection>> {
    state.connection.lock().map_err(|_| "Não foi possível acessar o banco local.".into())
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

#[tauri::command]
fn list_subjects(state: State<'_, AppState>) -> CommandResult<Vec<Subject>> {
    database::list_subjects(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_subject(state: State<'_, AppState>, input: SubjectInput) -> CommandResult<Subject> {
    let (name, color) = validate_subject(&input)?;
    database::insert_subject(
        &*locked_connection(&state)?,
        &name,
        input.weight,
        input.difficulty,
        &color,
        input.current_level.unwrap_or(1),
        input.target_level.unwrap_or(4),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn update_subject(state: State<'_, AppState>, id: i64, input: SubjectInput) -> CommandResult<Subject> {
    let (name, color) = validate_subject(&input)?;
    database::update_subject(
        &*locked_connection(&state)?,
        id,
        &name,
        input.weight,
        input.difficulty,
        &color,
        input.current_level.unwrap_or(1),
        input.target_level.unwrap_or(4),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_subject(state: State<'_, AppState>, id: i64) -> CommandResult<()> {
    if database::delete_subject(&*locked_connection(&state)?, id).map_err(|error| error.to_string())? {
        Ok(())
    } else {
        Err("Matéria não encontrada.".into())
    }
}

#[tauri::command]
fn update_subject_goals(state: State<'_, AppState>, id: i64, input: SubjectGoalInput) -> CommandResult<Subject> {
    validate_goals(&input)?;
    database::update_subject_goals(&*locked_connection(&state)?, id, input.goal_accuracy, input.goal_coverage)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_topics(state: State<'_, AppState>) -> CommandResult<Vec<Topic>> {
    database::list_topics(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_topic(state: State<'_, AppState>, input: TopicInput) -> CommandResult<Topic> {
    let name = validate_topic(&input)?;
    database::insert_topic(&*locked_connection(&state)?, input.subject_id, &name, &input.status)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn update_topic(state: State<'_, AppState>, id: i64, input: TopicInput) -> CommandResult<Topic> {
    let name = validate_topic(&input)?;
    database::update_topic(&*locked_connection(&state)?, id, input.subject_id, &name, &input.status)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_topic(state: State<'_, AppState>, id: i64) -> CommandResult<()> {
    if database::delete_topic(&*locked_connection(&state)?, id).map_err(|error| error.to_string())? {
        Ok(())
    } else {
        Err("Tópico não encontrado.".into())
    }
}

#[tauri::command]
fn update_material_page(state: State<'_, AppState>, id: i64, current_page: i64) -> CommandResult<StudyMaterial> {
    if current_page < 0 {
        return Err("A página atual não pode ser negativa.".into());
    }
    database::update_material_page(&*locked_connection(&state)?, id, current_page)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_profile(state: State<'_, AppState>) -> CommandResult<Profile> {
    database::get_profile(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn update_profile(state: State<'_, AppState>, input: ProfileInput) -> CommandResult<Profile> {
    validate_profile(&input)?;
    database::update_profile(&*locked_connection(&state)?, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn calculate_schedule(state: State<'_, AppState>, total_hours: f64) -> CommandResult<ScheduleResponse> {
    let subjects = database::list_subjects(&*locked_connection(&state)?).map_err(|error| error.to_string())?;
    scheduler::calculate_schedule(&subjects, total_hours)
}

#[tauri::command]
fn save_daily_log(
    state: State<'_, AppState>,
    total_hours: f64,
    allocation_data: serde_json::Value,
) -> CommandResult<()> {
    if !total_hours.is_finite() || total_hours <= 0.0 || total_hours > 24.0 {
        return Err("A carga diária para o registro é inválida.".into());
    }
    let allocation_json = serde_json::to_string(&allocation_data).map_err(|error| error.to_string())?;
    let date = Local::now().date_naive().to_string();
    database::save_daily_log(&*locked_connection(&state)?, &date, total_hours, &allocation_json)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_materials(state: State<'_, AppState>) -> CommandResult<Vec<StudyMaterial>> {
    database::list_materials(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_material(state: State<'_, AppState>, input: MaterialInput) -> CommandResult<StudyMaterial> {
    validate_material(&input)?;
    database::insert_material(&*locked_connection(&state)?, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn update_material(
    state: State<'_, AppState>,
    id: i64,
    input: MaterialInput,
) -> CommandResult<StudyMaterial> {
    validate_material(&input)?;
    database::update_material(&*locked_connection(&state)?, id, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_material(state: State<'_, AppState>, id: i64) -> CommandResult<()> {
    if database::delete_material(&*locked_connection(&state)?, id).map_err(|error| error.to_string())? {
        Ok(())
    } else {
        Err("Material não encontrado.".into())
    }
}

#[tauri::command]
fn record_question_result(
    state: State<'_, AppState>,
    input: QuestionResultInput,
) -> CommandResult<QuestionResult> {
    if input.date.trim().is_empty() || input.questions_total <= 0 || input.questions_correct < 0
        || input.questions_correct > input.questions_total || input.studied_minutes < 0 {
        return Err("Revise o lançamento de questões: acertos, total e tempo devem ser válidos.".into());
    }
    database::insert_question_result(&*locked_connection(&state)?, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_dashboard(state: State<'_, AppState>) -> CommandResult<DashboardData> {
    database::dashboard(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_priority_ranking(state: State<'_, AppState>) -> CommandResult<Vec<SubjectRanking>> {
    database::priority_ranking(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn performance_trend(
    state: State<'_, AppState>,
    granularity: String,
    subject_id: Option<i64>,
    topic_id: Option<i64>,
) -> CommandResult<Vec<PerformancePoint>> {
    database::performance_trend(
        &*locked_connection(&state)?,
        &granularity,
        subject_id,
        topic_id,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_subject_accuracy_trend(state: State<'_, AppState>) -> CommandResult<Vec<SubjectAccuracyPoint>> {
    database::subject_accuracy_trend(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_focus_overload_trend(state: State<'_, AppState>) -> CommandResult<Vec<FocusOverloadPoint>> {
    database::focus_overload_trend(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_day_allocations(state: State<'_, AppState>) -> CommandResult<Vec<DayAllocation>> {
    database::list_day_allocations(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_day_allocation(state: State<'_, AppState>, input: DayAllocationInput) -> CommandResult<Vec<DayAllocation>> {
    if !(0..=6).contains(&input.weekday) {
        return Err("Selecione um dia da semana válido para o reforço.".into());
    }
    if !(1..=600).contains(&input.minutes) {
        return Err("O tempo do bloco deve ficar entre 1 e 600 minutos.".into());
    }
    database::save_day_allocation(&*locked_connection(&state)?, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_day_allocation(state: State<'_, AppState>, subject_id: i64) -> CommandResult<Vec<DayAllocation>> {
    database::delete_day_allocation(&*locked_connection(&state)?, subject_id).map_err(|error| error.to_string())
}

fn validate_pomodoro_input(input: &PomodoroSessionInput) -> CommandResult<()> {
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

#[tauri::command]
fn list_pomodoro_sessions(state: State<'_, AppState>) -> CommandResult<Vec<PomodoroSession>> {
    database::list_pomodoro_sessions(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn complete_pomodoro_session(
    state: State<'_, AppState>,
    input: PomodoroSessionInput,
) -> CommandResult<SessionSummary> {
    validate_pomodoro_input(&input)?;
    database::complete_pomodoro_session(&*locked_connection(&state)?, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_focus_timebox(state: State<'_, AppState>, subject_id: i64) -> CommandResult<TimeboxSuggestion> {
    database::suggest_focus_timebox(&*locked_connection(&state)?, subject_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn log_brain_dump(state: State<'_, AppState>, input: BrainDumpLogInput) -> CommandResult<BrainDumpLog> {
    if input.note.trim().is_empty() {
        return Err("A captura externa não pode ser vazia.".into());
    }
    database::log_brain_dump(&*locked_connection(&state)?, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_brain_dumps(state: State<'_, AppState>) -> CommandResult<Vec<BrainDumpLog>> {
    database::list_brain_dumps(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_learning_speed(state: State<'_, AppState>, subject_id: Option<i64>) -> CommandResult<Vec<LearningSpeed>> {
    database::learning_speed(&*locked_connection(&state)?, subject_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_study_plan(state: State<'_, AppState>, input: PlanInput) -> CommandResult<PlanResponse> {
    database::generate_study_plan(&*locked_connection(&state)?, &input).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_material_strategies(state: State<'_, AppState>) -> CommandResult<Vec<MaterialStrategy>> {
    database::list_material_strategies(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn reschedule_buffer(state: State<'_, AppState>) -> CommandResult<ReschedulePlan> {
    database::reschedule_buffer(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_buffer_allocations(state: State<'_, AppState>) -> CommandResult<Vec<BufferAllocation>> {
    database::list_buffer_allocations(&*locked_connection(&state)?).map_err(|error| error.to_string())
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
fn list_memory_items(state: State<'_, AppState>) -> CommandResult<Vec<SpacedRepetitionItem>> {
    database::list_memory_items(&*locked_connection(&state)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_memory_item(state: State<'_, AppState>, input: MemoryItemInput) -> CommandResult<SpacedRepetitionItem> {
    let concept = validate_memory_item(&input)?;
    database::insert_memory_item(
        &*locked_connection(&state)?,
        input.subject_id,
        input.topic_id,
        &concept,
        input.difficulty,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_memory_item(state: State<'_, AppState>, id: i64) -> CommandResult<()> {
    if database::delete_memory_item(&*locked_connection(&state)?, id).map_err(|error| error.to_string())? {
        Ok(())
    } else {
        Err("Item de memória não encontrado.".into())
    }
}

#[tauri::command]
fn review_memory_item(state: State<'_, AppState>, id: i64, grade: String) -> CommandResult<SpacedRepetitionItem> {
    if !["again", "hard", "good", "easy"].contains(&grade.as_str()) {
        return Err("Avaliação de revisão inválida: use Errei, Difícil, Bom ou Fácil.".into());
    }
    database::review_memory_item(&*locked_connection(&state)?, id, &grade).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_memory_decay(state: State<'_, AppState>, id: i64) -> CommandResult<MemoryDecayProjection> {
    database::memory_decay_projection(&*locked_connection(&state)?, id).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_review_logs(state: State<'_, AppState>, item_id: i64) -> CommandResult<Vec<ReviewLog>> {
    database::list_review_logs(&*locked_connection(&state)?, item_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_retention_overview(
    state: State<'_, AppState>,
    horizon_days: Option<i64>,
) -> CommandResult<RetentionOverview> {
    database::retention_overview(&*locked_connection(&state)?, horizon_days)
        .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let database_path = app_data_dir.join("soaa.db");
            app.manage(AppState::new(&database_path)?);
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
            update_subject_goals,
            list_topics,
            create_topic,
            update_topic,
            delete_topic,
            update_material_page,
            list_pomodoro_sessions,
            complete_pomodoro_session,
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
            list_review_logs,
            get_retention_overview,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo SOAA");
}
