from app.modules.olympiads.corrections import changes, summary, text_diff

BASE = {
    "title": "Камень",
    "condition": "Камень бросили вверх со скоростью 20 м/с. Найдите высоту.",
    "unit": "м",
    "answer": "20",
    "answer_type": "number",
    "tolerance": 0.01,
    "max_points": 10,
    "translations": {},
}


def test_text_diff_marks_changed_words() -> None:
    diff = text_diff("скоростью 20 м/с", "скоростью 25 м/с")
    assert [s for s in diff if s["op"] != "equal"] == [{"op": "delete", "text": "20"}, {"op": "insert", "text": "25"}]
    assert "".join(s["text"] for s in diff if s["op"] != "delete") == "скоростью 25 м/с"


def test_long_unchanged_text_is_shortened() -> None:
    old = "а " * 100 + "ошибка"
    diff = text_diff(old, "а " * 100 + "исправлено")
    assert diff[0]["op"] == "equal" and diff[0]["text"].startswith("…") and len(diff[0]["text"]) <= 41


def test_changes_hide_answer_and_summarize() -> None:
    new = {**BASE, "condition": BASE["condition"].replace("20", "25"), "answer": "31,9", "max_points": 12}
    found = changes(BASE, new)
    assert [c["field"] for c in found] == ["condition", "answer", "max_points"]
    assert found[1] == {"field": "answer", "label": "Ответ", "hidden": True}  # ответ не раскрываем
    assert changes(BASE, dict(BASE)) == []
    text = summary("A", "Камень", found)
    assert text == "Исправлено в задаче A «Камень»: условие, ответ, баллы (автопроверка пересчитана)."


def test_translation_change() -> None:
    old = {**BASE, "translations": {"en": {"title": "Stone", "condition": "Speed 20"}}}
    new = {**BASE, "translations": {"en": {"title": "Stone", "condition": "Speed 25"}}}
    assert [c["label"] for c in changes(old, new)] == ["Условие (англ.)"]
