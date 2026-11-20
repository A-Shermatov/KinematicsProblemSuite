from app.modules.rating.elo import INITIAL_RATING, Participant, rating_changes, win_probability
from app.modules.rating.ranks import badge, ladder, rank_for


def test_win_probability_is_symmetric() -> None:
    assert win_probability(1500, 1500) == 0.5
    assert round(win_probability(1600, 1200), 3) == 0.909
    assert round(win_probability(1600, 1200) + win_probability(1200, 1600), 9) == 1


def test_newcomers_winner_gains_last_loses() -> None:
    people = [Participant(uid, INITIAL_RATING, place) for uid, place in ((1, 1), (2, 2), (3, 3), (4, 4), (5, 5))]
    delta = rating_changes(people)
    assert delta[1] > delta[2] > delta[3] > delta[4] > delta[5]
    assert delta[1] > 0 > delta[5]
    assert abs(sum(delta.values())) <= len(people) + 2  # рейтинг перераспределяется


def test_beating_stronger_gives_more() -> None:
    # Новичок обошёл сильного — получает больше, чем за победу над равным.
    upset = rating_changes([Participant(1, 1200, 1), Participant(2, 1800, 2)])
    equal = rating_changes([Participant(1, 1200, 1), Participant(2, 1200, 2)])
    assert upset[1] > equal[1] > 0
    assert upset[2] < 0
    # Сильный обошёл слабого, как и ожидалось, — прибавка намного меньше.
    expected = rating_changes([Participant(1, 1800, 1), Participant(2, 1200, 2)])
    assert 0 < expected[1] < upset[1] / 3


def test_ties_share_place_and_single_participant() -> None:
    tie = rating_changes([Participant(1, 1400, 1), Participant(2, 1400, 1)])
    assert tie[1] == tie[2]
    assert rating_changes([Participant(1, 1500, 1)]) == {1: 0}


def test_ranks() -> None:
    assert rank_for(None) is None
    assert rank_for(1199).code == "newbie"
    assert rank_for(1200).code == "pupil"
    assert rank_for(1650).name == "Эксперт"
    assert rank_for(3400).code == "legend"
    assert badge(1950) == {"code": "candidate", "icon": "⭐", "name": "Кандидат в мастера", "rating": 1950}
    steps = ladder(1450)
    assert [s["code"] for s in steps if s["earned"]] == ["newbie", "pupil", "specialist"]
    assert [s["code"] for s in steps if s["current"]] == ["specialist"]
    assert not any(s["earned"] for s in ladder(None))
