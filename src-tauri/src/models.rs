use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subject {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub weight: i64,
    pub difficulty: i64,
    pub computed_ip: i64,
    pub color: String,
    pub goal_accuracy: i64,
    pub goal_coverage: i64,
    pub current_level: i64,
    pub target_level: i64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectInput {
    pub name: String,
    pub weight: i64,
    pub difficulty: i64,
    pub color: Option<String>,
    #[serde(default)]
    pub current_level: Option<i64>,
    #[serde(default)]
    pub target_level: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectGoalInput {
    pub goal_accuracy: i64,
    pub goal_coverage: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Topic {
    pub id: i64,
    pub user_id: i64,
    pub subject_id: i64,
    pub name: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicInput {
    pub subject_id: i64,
    pub name: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayAllocation {
    pub id: i64,
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    /// 0 = Segunda … 6 = Domingo
    pub weekday: i64,
    pub minutes: i64,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayAllocationInput {
    pub subject_id: i64,
    pub weekday: i64,
    pub minutes: i64,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Allocation {
    #[serde(flatten)]
    pub subject: Subject,
    pub exact_minutes: f64,
    pub allocated_minutes: i64,
    pub formatted_time: String,
    pub percentage: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleResponse {
    pub total_hours: f64,
    pub total_minutes: i64,
    pub total_ip: i64,
    pub project_buffer_minutes: i64,
    pub formatted_project_buffer: String,
    pub allocations: Vec<Allocation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyMaterial {
    pub id: i64,
    pub user_id: i64,
    pub subject_id: Option<i64>,
    pub topic_id: Option<i64>,
    pub title: String,
    pub category: String,
    pub url_path: Option<String>,
    pub status: String,
    pub tags: Vec<String>,
    pub front: Option<String>,
    pub topic: Option<String>,
    pub page_focus: Option<String>,
    pub current_page: i64,
    pub total_pages: i64,
    pub remind_date: Option<String>,
    pub study_strategy: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialInput {
    pub subject_id: Option<i64>,
    pub topic_id: Option<i64>,
    pub title: String,
    pub category: String,
    pub url_path: Option<String>,
    pub status: String,
    pub tags: Vec<String>,
    pub front: Option<String>,
    pub topic: Option<String>,
    pub page_focus: Option<String>,
    pub current_page: i64,
    pub total_pages: i64,
    pub remind_date: Option<String>,
    #[serde(default)]
    pub study_strategy: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialReminder {
    pub id: i64,
    pub subject_id: Option<i64>,
    pub subject_name: Option<String>,
    pub title: String,
    pub front: Option<String>,
    pub topic: Option<String>,
    pub page_focus: Option<String>,
    pub remind_date: String,
    pub days_left: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub daily_hours: f64,
    pub weekly_days: i64,
    pub exam_track: String,
    pub start_date: Option<String>,
    pub exam_date: Option<String>,
    pub study_days: Vec<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub daily_hours: f64,
    pub weekly_days: i64,
    pub exam_track: String,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub exam_date: Option<String>,
    #[serde(default)]
    pub study_days: Vec<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionResultInput {
    pub subject_id: i64,
    pub topic_id: Option<i64>,
    pub date: String,
    pub questions_total: i64,
    pub questions_correct: i64,
    pub studied_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionResult {
    pub id: i64,
    pub subject_id: i64,
    pub topic_id: Option<i64>,
    pub date: String,
    pub questions_total: i64,
    pub questions_correct: i64,
    pub studied_minutes: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectPerformance {
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub questions_total: i64,
    pub questions_correct: i64,
    pub accuracy: f64,
    pub studied_minutes: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPerformance {
    pub date: String,
    pub accuracy: f64,
    pub total: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub profile: Profile,
    pub subjects_count: i64,
    pub materials: MaterialProgress,
    pub questions: QuestionProgress,
    pub weekly_study_minutes: i64,
    pub daily_performance: Vec<DailyPerformance>,
    pub subject_performance: Vec<SubjectPerformance>,
    pub reminders: Vec<MaterialReminder>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialProgress {
    pub total: i64,
    pub completed: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionProgress {
    pub total: i64,
    pub correct: i64,
    pub accuracy: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformancePoint {
    pub label: String,
    pub start_date: String,
    pub questions_total: i64,
    pub questions_correct: i64,
    pub accuracy: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectRanking {
    pub rank: i64,
    /// "up" (subiu), "down" (caiu), "same" (estável) ou "new" (sem histórico anterior)
    pub movement: String,
    #[serde(flatten)]
    pub subject: Subject,
    pub strategy_score: f64,
    pub deficit_score: f64,
    pub volume_score: f64,
    pub trend_score: f64,
    pub priority_score: f64,
    pub accuracy: f64,
    pub recent_accuracy: f64,
    pub previous_accuracy: f64,
    pub questions_total: i64,
    pub studied_minutes: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectAccuracyPoint {
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub date: String,
    pub questions_total: i64,
    pub accuracy: f64,
}

/// Zona de foco derivada da taxa de conclusão (`completion_rate`) do bloco.
/// Estratificação de risco: quanto menor a sustentação, maior a urgência ("Alta").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FocusZone {
    /// completion_rate >= 1.0 → zona Baixa (💚): absorção plena, pouco risco.
    Baixa,
    /// 0.6 <= completion_rate < 1.0 → zona Média (💛): bloco parcial, reforçe o tópico.
    Media,
    /// completion_rate < 0.6 → zona Alta (❤): saída precoce; retome o tópico em breve.
    Alta,
}

impl FocusZone {
    pub fn from_completion_rate(completion_rate: f64) -> Self {
        if completion_rate >= 1.0 {
            Self::Baixa
        } else if completion_rate >= 0.6 {
            Self::Media
        } else {
            Self::Alta
        }
    }

    /// Lê o valor texto gravado na coluna `zone` (`alta`/`media`/`baixa`).
    pub fn from_db(value: &str) -> Self {
        match value {
            "alta" => Self::Alta,
            "media" => Self::Media,
            _ => Self::Baixa,
        }
    }

    /// Forma textual persistida na coluna `zone`.
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Alta => "alta",
            Self::Media => "media",
            Self::Baixa => "baixa",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionInput {
    pub subject_id: i64,
    pub material_id: Option<i64>,
    pub goal_type: String,
    pub goal_text: Option<String>,
    pub page_start: Option<i64>,
    pub page_end: Option<i64>,
    pub planned_minutes: i64,
    pub elapsed_minutes: i64,
    pub interrupts: i64,
    pub exit_reason: Option<String>,
    pub completion_percentage: Option<f64>,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSession {
    pub id: i64,
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub material_id: Option<i64>,
    pub material_title: Option<String>,
    pub goal_type: String,
    pub goal_text: Option<String>,
    pub page_start: Option<i64>,
    pub page_end: Option<i64>,
    pub planned_minutes: i64,
    pub elapsed_minutes: i64,
    pub interrupts: i64,
    pub completion_rate: f64,
    /// Zona de foco calculada pelo backend a partir do completion_rate.
    pub zone: FocusZone,
    pub exit_reason: Option<String>,
    pub completed: bool,
    pub status: String,
    pub completion_percentage: Option<f64>,
    pub started_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub subject_id: i64,
    pub subject_name: String,
    pub planned_minutes: i64,
    pub elapsed_minutes: i64,
    pub interrupts: i64,
    pub completion_rate: f64,
    pub exit_reason: Option<String>,
    pub completion_percentage: Option<f64>,
    pub deep_work: bool,
    pub suggested_next: i64,
    pub suggestion_reason: String,
    pub efficiency_gain: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BufferAllocation {
    pub id: i64,
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub source_goal: Option<String>,
    pub debt_minutes: i64,
    pub destination: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RescheduleItem {
    pub source_session_id: i64,
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub goal: Option<String>,
    pub planned_minutes: i64,
    pub executed_minutes: i64,
    pub debt_minutes: i64,
    pub destination: String,
    pub destination_label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReschedulePlan {
    pub generated_date: String,
    pub total_debt_minutes: i64,
    pub saturday_minutes: i64,
    pub next_week_minutes: i64,
    pub protected_morning_hours: i64,
    pub items: Vec<RescheduleItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainDumpLogInput {
    pub subject_id: Option<i64>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainDumpLog {
    pub id: i64,
    pub subject_id: Option<i64>,
    pub subject_name: Option<String>,
    pub note: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeboxSuggestion {
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub resistance_index: f64,
    pub completed_streak: i64,
    pub previous_minutes: i64,
    pub suggested_minutes: i64,
    pub reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningSpeed {
    pub material_id: Option<i64>,
    pub material_title: Option<String>,
    pub sessions: i64,
    pub minutes_total: i64,
    pub pages_done: i64,
    pub minutes_per_page: Option<f64>,
    pub exercises_done: i64,
    pub minutes_per_exercise: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusOverloadPoint {
    /// 0 quando é a série agregada "Geral".
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub date: String,
    pub sessions: i64,
    pub planned_minutes: i64,
    pub elapsed_minutes: i64,
    /// % do tempo planejado que foi de fato sustentado no dia (Sobrecarga Progressiva).
    pub completion_rate: f64,
    pub deep_work_sessions: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialStrategy {
    pub id: i64,
    pub keywords: String,
    pub tactic: String,
    pub reason: String,
    pub intensity: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyMatch {
    pub tactic: String,
    pub reason: String,
    pub intensity: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanInput {
    pub start_date: String,
    pub exam_date: String,
    pub total_hours: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanFocus {
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub risk: i64,
    pub minutes: i64,
    pub slot: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDay {
    pub date: String,
    pub weekday_label: String,
    pub focus_subjects: Vec<PlanFocus>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanResponse {
    pub weeks: i64,
    pub risk_name: Option<String>,
    pub days: Vec<PlanDay>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpacedRepetitionItem {
    pub id: i64,
    pub user_id: i64,
    pub subject_id: Option<i64>,
    pub subject_name: Option<String>,
    pub color: String,
    pub topic_id: Option<i64>,
    pub topic_name: Option<String>,
    pub concept: String,
    /// Dificuldade do item na escala FSRS (1 = trivial … 10 = muito difícil).
    pub difficulty: f64,
    /// Stability em dias: tempo para a retrievability cair de 100% para 90%.
    pub stability: f64,
    pub reps: i64,
    pub last_review_date: String,
    /// Prevista para R = 90% (ponto ótimo de revisão).
    pub due_date: String,
    /// Retrievability atual (0–1) calculada a partir do Stability e dos dias decorridos.
    pub retrievability: f64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryItemInput {
    pub subject_id: Option<i64>,
    pub topic_id: Option<i64>,
    pub concept: String,
    pub difficulty: f64,
}

/// Registro de uma avaliação de revisão espaçada (tabela `fsrs_reviews`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsrsReview {
    pub id: i64,
    pub item_id: i64,
    /// "again" | "hard" | "good" | "easy"
    pub grade: String,
    pub grade_label: String,
    pub stability_before: f64,
    pub stability_after: f64,
    pub retrievability: f64,
    pub reviewed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryPoint {
    pub item_id: i64,
    pub day: i64,
    pub date: String,
    /// Retrievability apenas com a última revisão (decaimento natural).
    pub retrievability: f64,
    /// Retrievability sob o protocolo de revisões espaçadas (curva "Anki").
    pub anki: f64,
    /// Se houve revisão espaçada agendada neste dia.
    pub reviewed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryDecayProjection {
    pub item_id: i64,
    pub concept: String,
    pub subject_name: Option<String>,
    pub color: String,
    pub stability: f64,
    pub difficulty: f64,
    /// Dia (a partir da última revisão) em que R cruza 90% sem revisar.
    pub optimal_day: i64,
    pub optimal_date: String,
    pub retrievability_today: f64,
    /// Dias restando até o ponto ótimo de revisão.
    pub due_in_days: i64,
    /// Projeção dia a dia: curva natural + curva com revisões espaçadas.
    pub points: Vec<MemoryPoint>,
}

/// Série temporal única do painel de retenção — um dataKey do Recharts.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionSeriesInfo {
    /// Chave única usada como dataKey (nome da matéria ou "matéria › nicho").
    pub key: String,
    pub name: String,
    /// "global" | "subject" | "topic"
    pub level: String,
    pub subject_id: i64,
    pub topic_id: i64,
    pub color: String,
    pub items: i64,
    /// Stability média do grupo (dias).
    pub avg_stability: f64,
    /// Retrievability média do grupo hoje (0–1).
    pub retrievability_today: f64,
    /// Dias restando até o primeiro item do grupo cruzar a janela ótima (90%).
    pub due_in_days: i64,
}

/// Resposta agregada: metadados das séries + linhas multichave prontas para o Recharts.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionOverview {
    pub generated_date: String,
    pub horizon_days: i64,
    pub series: Vec<RetentionSeriesInfo>,
    /// Cada linha: { "day": 0..N, "date": "YYYY-MM-DD", "<key>": percentual }
    pub rows: Vec<serde_json::Value>,
}

/// Ponto da curva de retenção — coordenada pura para o Recharts: (dia, probabilidade %).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionCurvePoint {
    /// Dia contado a partir da última revisão.
    pub x: i64,
    /// Probabilidade de lembrar (0–100).
    pub y: f64,
}

/// Curva de retenção do motor FSRS regressa ao React apenas coordenadas + a flag
/// do momento exato em que a retenção cruza a linha de 90%.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionCurve {
    pub points: Vec<RetentionCurvePoint>,
    /// Primeiro dia em que y <= 90 (None quando a retenção já está abaixo de 90% hoje
    /// ou quando não há dados para projetar).
    pub crosses_at_day: Option<i64>,
}

/// Tick do livestream de retenção — amostra em tempo real por matéria,
/// usada no card "Retenção · livestream" do Painel de Desempenho.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceLiveTick {
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    /// Taxa de acerto no histórico de questões (0–100).
    pub accuracy: f64,
    /// Variação da retenção média nos próximos 3 dias (projeção FSRS).
    pub retention_delta: f64,
    /// Matéria atrasada: itens vencidos e retenção média abaixo do piso.
    pub overdue: bool,
    /// Tem muitos blocos parciais (>= 3) — aviso vermelho de foco fragmentado.
    pub many_partials: bool,
}

/// Uma janela do livestream: instante em que foi gerado + amostras por matéria.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceLiveStream {
    pub generated_at: String,
    pub horizon_minutes: i64,
    pub ticks: Vec<PerformanceLiveTick>,
}

/// Linha do relatório consolidado de desempenho por matéria.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidatedPerformanceRow {
    pub subject_id: i64,
    pub subject_name: String,
    pub color: String,
    pub rank: i64,
    pub accuracy: f64,
    pub questions_total: i64,
    pub questions_correct: i64,
    /// Retrievabilidade média dos itens de memória da matéria (0–100).
    pub retention_today: f64,
    /// Dias até o primeiro item cruzar a janela ótima (negativo = atrasado).
    pub due_in_days: i64,
    pub overdue_items: i64,
    pub deep_work_blocks: i64,
    pub partial_blocks: i64,
    pub has_many_partials: bool,
    pub is_overdue: bool,
}

/// Totais agregados do relatório consolidado de desempenho.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidatedPerformanceTotals {
    pub questions_total: i64,
    pub questions_correct: i64,
    pub accuracy: f64,
    pub deep_work_blocks: i64,
    pub partial_blocks: i64,
    pub overdue_items: i64,
    pub subjects_late: i64,
}

/// Relatório consolidado de desempenho — ranking com retenção e foco + totais.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidatedPerformanceReport {
    pub generated_at: String,
    pub horizon_days: i64,
    pub ranking: Vec<ConsolidatedPerformanceRow>,
    pub totals: ConsolidatedPerformanceTotals,
}
