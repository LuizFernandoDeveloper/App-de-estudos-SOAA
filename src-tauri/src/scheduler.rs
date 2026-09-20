use crate::models::{Allocation, ScheduleResponse, Subject};

pub fn format_minutes(minutes: i64) -> String {
    let safe_minutes = minutes.max(0);
    let hours = safe_minutes / 60;
    let remaining = safe_minutes % 60;
    match (hours, remaining) {
        (0, minutes) => format!("{minutes}m"),
        (hours, 0) => format!("{hours}h"),
        (hours, minutes) => format!("{hours}h {minutes}m"),
    }
}

/// Distribui minutos em blocos de 5 usando o método dos maiores restos.
/// Assim cada bloco é executável e a soma nunca ultrapassa o tempo informado.
pub fn calculate_schedule(subjects: &[Subject], total_hours: f64) -> Result<ScheduleResponse, String> {
    if !total_hours.is_finite() || total_hours <= 0.0 || total_hours > 24.0 {
        return Err("Informe uma carga entre 0,1 e 24 horas.".into());
    }
    if subjects.is_empty() {
        return Err("Cadastre ao menos uma matéria antes de calcular a matriz.".into());
    }

    let total_ip: i64 = subjects.iter().map(|subject| subject.computed_ip).sum();
    if total_ip <= 0 {
        return Err("O somatório dos índices de prioridade deve ser maior que zero.".into());
    }

    let total_minutes = (total_hours * 60.0).round() as i64;
    let exact: Vec<f64> = subjects
        .iter()
        .map(|subject| subject.computed_ip as f64 / total_ip as f64 * total_minutes as f64)
        .collect();
    let mut allocated: Vec<i64> = exact.iter().map(|minutes| (minutes / 5.0).floor() as i64 * 5).collect();
    let base_total: i64 = allocated.iter().sum();
    let blocks_to_distribute = ((total_minutes - base_total) / 5).max(0) as usize;

    let mut by_remainder: Vec<usize> = (0..subjects.len()).collect();
    by_remainder.sort_by(|left, right| {
        let right_remainder = exact[*right] % 5.0;
        let left_remainder = exact[*left] % 5.0;
        right_remainder
            .partial_cmp(&left_remainder)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| subjects[*right].computed_ip.cmp(&subjects[*left].computed_ip))
    });
    for index in by_remainder.into_iter().take(blocks_to_distribute) {
        allocated[index] += 5;
    }

    let allocated_total: i64 = allocated.iter().sum();
    let project_buffer_minutes = total_minutes - allocated_total;
    let allocations = subjects
        .iter()
        .cloned()
        .zip(exact)
        .zip(allocated)
        .map(|((subject, exact_minutes), allocated_minutes)| Allocation {
            percentage: (subject.computed_ip as f64 / total_ip as f64 * 1000.0).round() / 10.0,
            formatted_time: format_minutes(allocated_minutes),
            subject,
            exact_minutes,
            allocated_minutes,
        })
        .collect();

    Ok(ScheduleResponse {
        total_hours,
        total_minutes,
        total_ip,
        project_buffer_minutes,
        formatted_project_buffer: format_minutes(project_buffer_minutes),
        allocations,
    })
}

/* ---------------------------------------------------------------- */
/* Motor de Repetição Espaçada (modelo FSRS simplificado)            */
/* ---------------------------------------------------------------- */

pub fn today_iso() -> String {
    chrono::Local::now().date_naive().to_string()
}

pub fn parse_date(value: &str) -> chrono::NaiveDate {
    chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Local::now().date_naive())
}

pub fn days_since(from: &str, to: &str) -> f64 {
    (parse_date(to) - parse_date(from)).num_days() as f64
}

/// R(t) = (1 + t / (9 * S))^-1
/// R = probabilidade de lembrança; S = Stability em dias (R cai a 90% em t = S).
pub fn calculate_retrievability(stability: f64, elapsed_days: f64) -> f64 {
    let stability = stability.max(0.01);
    let value = 1.0 / (1.0 + elapsed_days.max(0.0) / (9.0 * stability));
    value.clamp(0.0, 1.0)
}

pub fn due_date_iso(last_review: &str, stability: f64) -> String {
    let days = stability.round().max(1.0) as i64;
    (parse_date(last_review) + chrono::Duration::days(days)).to_string()
}

pub fn grade_multiplier(grade: &str) -> f64 {
    match grade {
        "again" => 0.8,
        "hard" => 1.2,
        "good" => 2.2,
        "easy" => 3.0,
        _ => 2.2,
    }
}

pub fn grade_label(grade: &str) -> String {
    match grade {
        "again" => "Errei".into(),
        "hard" => "Difícil".into(),
        "good" => "Bom".into(),
        "easy" => "Fácil".into(),
        _ => "Bom".into(),
    }
}

pub fn difficulty_scale(difficulty: f64) -> f64 {
    0.9 + (10.0 - difficulty.clamp(1.0, 10.0)) * 0.02
}

#[cfg(test)]
mod tests {
    use super::*;

    fn subject(id: i64, ip: i64) -> Subject {
        Subject {
            id,
            user_id: 1,
            name: format!("Matéria {id}"),
            weight: ip,
            difficulty: 1,
            computed_ip: ip,
            color: "blue".into(),
            goal_accuracy: 75,
            goal_coverage: 100,
            current_level: 1,
            target_level: 5,
            created_at: String::new(),
        }
    }

    #[test]
    fn allocates_proportionally_in_five_minute_blocks() {
        let result = calculate_schedule(&[subject(1, 20), subject(2, 10)], 3.0).unwrap();
        assert_eq!(result.total_ip, 30);
        assert_eq!(result.allocations[0].allocated_minutes, 120);
        assert_eq!(result.allocations[1].allocated_minutes, 60);
        assert_eq!(result.project_buffer_minutes, 0);
    }

    #[test]
    fn preserves_remainder_as_project_buffer() {
        let result = calculate_schedule(&[subject(1, 1)], 1.02).unwrap();
        assert_eq!(result.allocations[0].allocated_minutes, 60);
        assert_eq!(result.project_buffer_minutes, 1);
    }

    #[test]
    fn rejects_empty_subjects() {
        assert!(calculate_schedule(&[], 4.0).is_err());
    }

    #[test]
    fn retrievability_is_90_percent_at_stability_days() {
        let retrievability = calculate_retrievability(10.0, 10.0);
        assert!((retrievability - 0.9).abs() < 0.001);
    }

    #[test]
    fn retrievability_decays_with_elapsed_days() {
        let day_1 = calculate_retrievability(5.0, 1.0);
        let day_30 = calculate_retrievability(5.0, 30.0);
        assert!(day_1 > day_30);
        assert!(day_30 >= 0.0 && day_30 <= 1.0);
    }

    #[test]
    fn due_date_adds_stability_days() {
        assert_eq!(due_date_iso("2026-08-01", 12.0), "2026-08-13");
    }

    #[test]
    fn grade_multipliers_raise_stability() {
        let base = 10.0;
        assert!(base * grade_multiplier("again") < base * grade_multiplier("hard"));
        assert!(base * grade_multiplier("hard") < base * grade_multiplier("good"));
        assert!(base * grade_multiplier("good") < base * grade_multiplier("easy"));
    }

    #[test]
    fn difficulty_scale_flattens_hard_items() {
        assert!(difficulty_scale(1.0) > difficulty_scale(10.0));
        assert_eq!(difficulty_scale(5.0), 1.0);
    }

    #[test]
    fn days_since_counts_calendar_days() {
        assert_eq!(days_since("2026-08-01", "2026-08-11"), 10.0);
    }
}
