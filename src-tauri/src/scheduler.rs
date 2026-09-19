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
}
