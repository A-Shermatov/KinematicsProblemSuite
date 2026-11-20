import { useState, type FormEvent } from "react";
import { api, type Attempt } from "../api";
import { Button, ErrorMessage, Input, Modal, Textarea } from "../components/ui";
import { formatDateTime } from "../lib/format";
import { errorText } from "../lib/hooks";

/** Оценка решения учителем или администратором. */
export function GradeDialog({ attempt, onClose, onSaved }: { attempt: Attempt; onClose: () => void; onSaved: (a: Attempt) => void }) {
  const [grade, setGrade] = useState(String(attempt.teacher_grade ?? attempt.system_grade ?? 100));
  const [feedback, setFeedback] = useState(attempt.status === "graded" ? attempt.feedback : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.attempts.grade(attempt.id, Number(grade), feedback));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Оценка решения">
      <form onSubmit={submit} className="w-[min(36rem,85vw)] space-y-4 p-2">
        <div>
          <h2 className="text-lg font-semibold text-fg">{attempt.task_title}</h2>
          <p className="text-sm text-muted">
            {attempt.student_name || attempt.student_username} · {formatDateTime(attempt.created_at)}
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-4 text-sm">
          <p className="text-muted">Ответ ученика</p>
          <p className="mt-1 whitespace-pre-wrap font-mono text-fg">{attempt.answer || "—"}</p>
          {attempt.correct_answer && (
            <p className="mt-3 text-muted">
              Эталон: <span className="font-mono text-fg">{attempt.correct_answer}{attempt.task_unit ? ` ${attempt.task_unit}` : ""}</span>
            </p>
          )}
        </div>
        {attempt.image_url && (
          <a href={attempt.image_url} target="_blank" rel="noreferrer">
            <img src={attempt.image_url} alt="Фото решения" className="max-h-80 w-full rounded-xl object-contain" />
          </a>
        )}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Input label="Баллы (0–100)" type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(e.target.value)} required />
          <Textarea label="Комментарий ученику" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={saving}>
            Сохранить оценку
          </Button>
        </div>
      </form>
    </Modal>
  );
}
