import asyncio
import json

import pytest

from app.modules.imports import translate as tr

SOURCE = {
    "title": "Камень",
    "condition": (
        "Камень бросили со скоростью {v} м/с. Найдите $h = \\frac{v^2}{2g}$, $g = 10\\ \\text{м/с}^2$."
        "\n\n![рисунок](/uploads/a.png)"
    ),
    "hints": ["Используйте $E = mgh$"],
}
GOOD = {
    "title": "Stone",
    "condition": (
        "A stone is thrown at {v} m/s. Find $h = \\frac{v^2}{2g}$, $g = 10\\ \\text{m/s}^2$."
        "\n\n![figure](/uploads/a.png)"
    ),
    "hints": ["Use $E = mgh$"],
}


def test_fingerprint_ignores_text_inside_math_but_not_formulas() -> None:
    assert tr.broken(SOURCE, GOOD) == []
    bad = {**GOOD, "condition": GOOD["condition"].replace("\\frac{v^2}{2g}", "v^2/2g")}
    assert tr.broken(SOURCE, bad) == ["condition"]
    assert tr.broken(SOURCE, {**GOOD, "condition": GOOD["condition"].replace("{v}", "v")}) == ["condition"]
    assert tr.broken(SOURCE, {**GOOD, "condition": GOOD["condition"].replace("/uploads/a.png", "x.png")}) == [
        "condition"
    ]
    assert tr.broken(SOURCE, {**GOOD, "hints": []}) == ["hints"]


def test_translate_retries_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    answers = iter([{**GOOD, "condition": "сломано"}, GOOD])

    def fake_generate(body: bytes, model: str | None = None) -> tuple[dict, str]:
        assert "английский" in json.loads(body)["contents"][0]["parts"][0]["text"]
        text = json.dumps(next(answers), ensure_ascii=False)
        return {"candidates": [{"content": {"parts": [{"text": text}]}}]}, "gemini-test"

    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setattr(tr, "generate", fake_generate)
    result, model = asyncio.run(tr.translate({**SOURCE, "explanation": ""}, "ru", "en"))
    assert result["condition"] == GOOD["condition"] and result["explanation"] == "" and model == "gemini-test"


def test_translate_gives_up(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken_generate(body: bytes, model: str | None = None) -> tuple[dict, str]:
        return {
            "candidates": [{"content": {"parts": [{"text": json.dumps({"title": "x", "condition": "", "hints": []})}]}}]
        }, "m"

    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setattr(tr, "generate", broken_generate)
    with pytest.raises(tr.AIUnavailableError, match="испортил"):
        asyncio.run(tr.translate(SOURCE, "ru", "tg"))


def test_translate_endpoint(client, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    async def fake(fields: dict, source: str, target: str, model: str | None = None) -> tuple[dict, str]:
        return {**fields, "title": f"[{target}] {fields['title']}"}, "fake-model"

    from app.modules.imports import router

    monkeypatch.setattr(router, "translate_fields", fake)
    teacher = client.teacher()
    url = "/api/tasks/import/translate"
    assert client.post(url, client.student(), json={"target": "en", "title": "Камень"}).status_code == 403
    assert client.post(url, teacher, json={"source": "en", "target": "en", "title": "x"}).status_code == 422
    done = client.post(url, teacher, json={"target": "tg", "title": "Камень", "condition": "$v$"}).json()
    assert (done["title"], done["condition"], done["model"]) == ("[tg] Камень", "$v$", "fake-model")
