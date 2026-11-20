from app.modules.olympiads.photos import Fingerprint, distance, fingerprint, same_photo
from tests.conftest import tiny_png


def test_exact_copy_and_distance() -> None:
    data = tiny_png()
    first, second = fingerprint(data), fingerprint(data)
    assert first.sha256 == second.sha256
    assert same_photo(first, second.sha256, second.phash)
    assert not same_photo(first, fingerprint(tiny_png((1, 2, 3))).sha256, None)
    assert distance(0b1011, 0b0010) == 2
    assert distance(-1, 0) == 64  # BIGINT со знаком


def test_near_duplicate_by_phash() -> None:
    mine = Fingerprint("a", 0b1111_0000)
    assert same_photo(mine, "b", 0b1111_0011)  # 2 бита отличаются — то же фото
    assert not same_photo(mine, "b", 0xFFFF0F)  # 14 бит
    assert not same_photo(Fingerprint("a", None), "b", 0b1111_0000)


def test_dhash_detects_resized_copy() -> None:
    import io

    import pytest

    image_module = pytest.importorskip("PIL.Image")
    picture = image_module.new("L", (200, 160))
    picture.putdata([(x * 7 + y * 3) % 256 for y in range(160) for x in range(200)])

    def encode(img: object, fmt: str) -> bytes:
        buffer = io.BytesIO()
        img.save(buffer, fmt)  # type: ignore[attr-defined]
        return buffer.getvalue()

    original = fingerprint(encode(picture, "PNG"))
    resized = fingerprint(encode(picture.resize((120, 96)), "JPEG"))
    assert original.phash is not None and original.sha256 != resized.sha256
    assert same_photo(original, resized.sha256, resized.phash)
    other = image_module.new("L", (200, 160))
    other.putdata([(x * x + 5 * y) % 256 for y in range(160) for x in range(200)])
    assert not same_photo(original, None, fingerprint(encode(other, "PNG")).phash)
