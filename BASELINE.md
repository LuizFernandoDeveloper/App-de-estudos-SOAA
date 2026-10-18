# BASELINE TÉCNICO - SOAA

**Data:** 2026-10-07 19:56:49
**Objetivo:** Registrar comportamento atual antes de qualquer modificação (baseline para evitar regressões).

## 1. Versões Principais

| Ferramenta | Versão | Observação |
|---|---|---|
| Rust (rustc) | 1.96.0 (ac68faa20 2026-05-25) | Toolchain estável |
| Cargo | 1.96.0 (30a34c682 2026-05-25) | |
| Node.js | v24.16.0 | |
| npm | 11.13.0 | |
| TypeScript | 7.0.2 | tsc --version |
| Vite | 8.3.0 | Conforme build |
| Vitest | 5.0.1 | Test runner frontend |
| Tauri | 2.11.1 (core), @tauri-apps/cli 2.11.4 | Conforme package.json/Cargo.toml |
| Rusqlite | 0.38 (bundled) | Backend SQLite |
| Chrono | 0.4 | |
| Serde | 1.0 | |

## 2. Comandos Executados

| Etapa | Comando | Finalidade |
|---|---|---|
| 1. Testes Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | Executar todos os testes unitários Rust |
| 2. Testes Vitest | `npx vitest run` | Executar todos os testes frontend (85 testes) |
| 3. Typecheck | `npx tsc --noEmit` | Verificação de tipos TypeScript |
| 4. Lint | `npx eslint .` (tentativa) | Tentativa de lint (sem config ESLint) |
| 5. Build Frontend | `npx vite build` | Build produção frontend (Vite) |
| 6. Build Tauri (diagnóstico) | `npx @tauri-apps/cli build --no-bundle` | Tentativa build Tauri fresh (diagnóstico ambiente) |

## 3. Resultados

### 3.1 Testes Rust
- **Status:** ✅ PASSOU
- **Testes:** 12 (12/12 passando)
- **Suites:** scheduler::tests (9), database::tests (3)

### 3.2 Testes Vitest
- **Status:** ✅ PASSOU
- **Arquivos:** 5 | **Testes:** 85 (85/85 passando)
- **Duração:** 32.60s

### 3.3 Typecheck
- **Status:** ✅ PASSOU (0 erros)

### 3.4 Lint (ESLint)
- **Status:** ⚠️ NÃO CONFIGURADO (sem eslint.config.*/.eslintrc*)

### 3.5 Build Frontend
- **Status:** ✅ SUCESSO (dist/ gerado)

### 3.6 Build Tauri
- **Status:** ⚠️ AMBIENTE - Artefatos existentes em target/release/*; tentativa fresh falhou por deps Cargo (não regressão)

## 4. Quantidade de Testes
- **Rust:** 12 | **Vitest:** 85 | **Total:** 97 (100% passando)

## 5. Falhas Existentes
Nenhuma falha funcional. Apenas warnings/configuração/ambiente.

## 6. Observações
Baseline registra estado verde (97/97 testes passando). Sem alterações de código neste passo.
