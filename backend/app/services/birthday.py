from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.birthday import BirthdayProfile, BirthdayTemplate
from app.models.user import User, UserRole
from app.schemas.birthday import (
    BirthdayCollectionRead,
    BirthdayPersonRead,
    BirthdayPersonUpdate,
    BirthdayTemplateCreate,
    BirthdayTemplateRead,
    BirthdayTemplateUpdate,
)
from app.schemas.user import UserRead

DEFAULT_BIRTHDAY_TEMPLATES = [
    {
        'title': 'Радость и мир',
        'message': 'С днём рождения, {name}. Пусть Господь наполняет твой путь радостью, внутренним миром и ясностью в каждом новом этапе жизни.',
        'scripture': 'Римлянам 15:13 — о надежде, радости и мире в вере.',
    },
    {
        'title': 'Крепость на сезон',
        'message': 'С днём рождения, {name}. Пусть Бог укрепляет тебя в каждом труде, даёт силы на служение и сохраняет сердце в покое.',
        'scripture': 'Исаия 40:31 — о новой силе для уповающих на Господа.',
    },
    {
        'title': 'Мудрость и свет',
        'message': 'С днём рождения, {name}. Пусть Господь ведёт тебя Своей мудростью, открывает верные решения и делает твой путь светлым.',
        'scripture': 'Псалом 118:105 — о свете Божьего слова на пути.',
    },
    {
        'title': 'Благодать в служении',
        'message': 'С днём рождения, {name}. Пусть в твоей жизни умножается Божья благодать, а всё, к чему ты прикасаешься в служении, приносит плод.',
        'scripture': '2 Коринфянам 9:8 — о благодати, достатке и добром деле.',
    },
    {
        'title': 'Мир в сердце',
        'message': 'С днём рождения, {name}. Пусть Господь хранит твоё сердце в мире, убирает лишнюю тревогу и даёт уверенность в завтрашнем дне.',
        'scripture': 'Филиппийцам 4:7 — о мире Божьем, который хранит сердце.',
    },
    {
        'title': 'Верность призванию',
        'message': 'С днём рождения, {name}. Пусть Бог помогает тебе оставаться верным в малом и великом, а призвание становится всё яснее.',
        'scripture': '1 Коринфянам 15:58 — о твёрдости и не напрасном труде в Господе.',
    },
    {
        'title': 'Новая глубина',
        'message': 'С днём рождения, {name}. Пусть этот год принесёт тебе новую глубину в отношениях с Богом, зрелость и тихую радость от Его присутствия.',
        'scripture': 'Иакова 4:8 — о приближении к Богу.',
    },
    {
        'title': 'Свет для других',
        'message': 'С днём рождения, {name}. Пусть твоя жизнь остаётся светом для людей, а Господь использует твои дары во благо Церкви и команды.',
        'scripture': 'Матфея 5:16 — о свете, который видят люди.',
    },
    {
        'title': 'Обновление сил',
        'message': 'С днём рождения, {name}. Пусть Бог обновляет твои силы, возвращает вдохновение и даёт идти вперёд без внутреннего истощения.',
        'scripture': 'Плач Иеремии 3:22-23 — о милости, обновляющейся каждое утро.',
    },
    {
        'title': 'Мягкое сердце',
        'message': 'С днём рождения, {name}. Пусть Господь хранит твоё сердце живым, чутким и способным слышать Его голос среди шума этого мира.',
        'scripture': 'Иезекииль 36:26 — о новом сердце и новом духе.',
    },
    {
        'title': 'Радость в простом',
        'message': 'С днём рождения, {name}. Пусть Бог учит тебя видеть Его заботу в простых вещах, радоваться жизни и замечать Его верность каждый день.',
        'scripture': 'Псалом 22 — о заботе и водительстве Господа.',
    },
    {
        'title': 'Мужество и покой',
        'message': 'С днём рождения, {name}. Пусть Господь даёт тебе мужество там, где нужны решения, и покой там, где не нужно бороться своими силами.',
        'scripture': 'Иисуса Навина 1:9 — о смелости и Божьем присутствии.',
    },
    {
        'title': 'Плод и стабильность',
        'message': 'С днём рождения, {name}. Пусть этот год будет временем стабильности, здорового роста и доброго плода во всех важных для тебя сферах.',
        'scripture': 'Псалом 1:3 — о дереве, приносящем плод в своё время.',
    },
    {
        'title': 'Надежда без стыда',
        'message': 'С днём рождения, {name}. Пусть надежда в Господе укрепляет тебя и не даёт сердцу сдаваться даже в трудные сезоны.',
        'scripture': 'Римлянам 5:5 — о надежде, которая не постыжает.',
    },
    {
        'title': 'Божья верность',
        'message': 'С днём рождения, {name}. Пусть память о Божьей верности в прошлом даёт тебе уверенность смотреть в будущее спокойно и с доверием.',
        'scripture': 'Псалом 88:2 — о провозглашении Божьей верности.',
    },
    {
        'title': 'Любовь и единство',
        'message': 'С днём рождения, {name}. Пусть Господь укрепляет тебя в любви, а через твою жизнь созидает единство, тепло и мир вокруг.',
        'scripture': 'Колоссянам 3:14-15 — о любви и мире Христовом.',
    },
    {
        'title': 'Тихая уверенность',
        'message': 'С днём рождения, {name}. Пусть в твоём сердце будет тихая уверенность, что Бог держит всё под Своим контролем и ведёт тебя верно.',
        'scripture': 'Притчи 3:5-6 — о доверии Господу всем сердцем.',
    },
    {
        'title': 'Вдохновение и творчество',
        'message': 'С днём рождения, {name}. Пусть Бог наполняет тебя свежими идеями, творческим вдохновением и радостью созидать прекрасное для Него.',
        'scripture': 'Исход 35:31-32 — о мудрости, разуме и искусстве для дела.',
    },
    {
        'title': 'Покрытие благодатью',
        'message': 'С днём рождения, {name}. Пусть благодать Господа покрывает твои слабые места, а в сильных сторонах помогает оставаться смиренным и верным.',
        'scripture': '2 Коринфянам 12:9 — о силе Божьей, совершающейся в немощи.',
    },
    {
        'title': 'Добрый след',
        'message': 'С днём рождения, {name}. Пусть твоя жизнь оставляет после себя добрый след, а всё прожитое в этом году приближает тебя к Божьему замыслу.',
        'scripture': 'Ефесянам 2:10 — о добрых делах, приготовленных Богом.',
    },
]


def get_visible_users(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.role != UserRole.DELETED.value)
        .order_by(User.full_name.asc(), User.login.asc())
        .all()
    )


def ensure_default_birthday_templates(db: Session) -> None:
    existing = db.query(BirthdayTemplate).count()
    if existing:
        return
    for index, template in enumerate(DEFAULT_BIRTHDAY_TEMPLATES, start=1):
        db.add(
            BirthdayTemplate(
                title=template['title'],
                message=template['message'],
                scripture=template['scripture'],
                sort_order=index,
                is_active=True,
            )
        )
    db.commit()


def build_birthday_payload(db: Session) -> BirthdayCollectionRead:
    ensure_default_birthday_templates(db)
    users = get_visible_users(db)
    profiles = {profile.user_id: profile for profile in db.query(BirthdayProfile).all()}
    today = date.today()

    people: list[BirthdayPersonRead] = []
    for user in users:
        profile = profiles.get(user.id)
        next_birthday = None
        days_until = None
        if profile:
            next_birthday = _next_birthday(profile.birth_date, today)
            days_until = (next_birthday - today).days
        people.append(
            BirthdayPersonRead(
                user=UserRead.model_validate(user, from_attributes=True),
                birth_date=profile.birth_date if profile else None,
                genitive_name=profile.genitive_name if profile else None,
                address_form=profile.address_form if profile else None,
                note=profile.note if profile else None,
                next_birthday=next_birthday,
                days_until=days_until,
            )
        )

    people.sort(key=lambda person: (person.days_until is None, person.days_until or 9999, (person.user.full_name or person.user.login).lower()))
    templates = db.query(BirthdayTemplate).order_by(BirthdayTemplate.sort_order.asc(), BirthdayTemplate.id.asc()).all()

    return BirthdayCollectionRead(
        today=today,
        people=people,
        templates=[BirthdayTemplateRead.model_validate(template, from_attributes=True) for template in templates],
    )


def upsert_birthday_person(db: Session, user_id: int, payload: BirthdayPersonUpdate) -> None:
    user = db.get(User, user_id)
    if not user or user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Пользователь не найден')

    profile = db.query(BirthdayProfile).filter(BirthdayProfile.user_id == user_id).first()
    genitive_name = (payload.genitive_name or '').strip() or None
    note = (payload.note or '').strip() or None
    address_form = payload.address_form

    if payload.birth_date is None:
        if profile:
            db.delete(profile)
            db.commit()
        return

    if profile is None:
        profile = BirthdayProfile(
            user_id=user_id,
            birth_date=payload.birth_date,
            genitive_name=genitive_name,
            address_form=address_form,
            note=note,
        )
    else:
        profile.birth_date = payload.birth_date
        profile.genitive_name = genitive_name
        profile.address_form = address_form
        profile.note = note
    db.add(profile)
    db.commit()


def create_birthday_template(db: Session, payload: BirthdayTemplateCreate) -> None:
    title = payload.title.strip()
    message = payload.message.strip()
    scripture = (payload.scripture or '').strip() or None
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Название шаблона не может быть пустым')
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Текст шаблона не может быть пустым')
    db.add(
        BirthdayTemplate(
            title=title,
            message=message,
            scripture=scripture,
            sort_order=payload.sort_order,
            is_active=payload.is_active,
        )
    )
    db.commit()


def update_birthday_template(db: Session, template_id: int, payload: BirthdayTemplateUpdate) -> None:
    template = db.get(BirthdayTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Шаблон не найден')
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Название шаблона не может быть пустым')
        template.title = title
    if payload.message is not None:
        message = payload.message.strip()
        if not message:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Текст шаблона не может быть пустым')
        template.message = message
    if payload.scripture is not None:
        template.scripture = payload.scripture.strip() or None
    if payload.sort_order is not None:
        template.sort_order = payload.sort_order
    if payload.is_active is not None:
        template.is_active = payload.is_active
    db.add(template)
    db.commit()


def delete_birthday_template(db: Session, template_id: int) -> None:
    template = db.get(BirthdayTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Шаблон не найден')
    db.delete(template)
    db.commit()


def _next_birthday(birth_date: date, today: date) -> date:
    candidate = _replace_birthday_year(birth_date, today.year)
    if candidate < today:
        candidate = _replace_birthday_year(birth_date, today.year + 1)
    return candidate


def _replace_birthday_year(birth_date: date, year: int) -> date:
    try:
        return birth_date.replace(year=year)
    except ValueError:
        # 29 февраля переносим на 28 февраля в невисокосный год.
        return birth_date.replace(year=year, month=2, day=28)
