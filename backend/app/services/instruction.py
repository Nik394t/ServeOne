from datetime import date
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.instruction import InstructionGuide, InstructionProgress
from app.models.schedule import Position, WeeklyAssignment
from app.models.user import User, UserRole
from app.schemas.instruction import ChecklistItem, InstructionCollectionRead, InstructionRead, InstructionUpdate
from app.services.schedule import ensure_default_positions, ensure_service_week, get_effective_service_date

DEFAULT_GUIDES: dict[str, dict[str, object]] = {
    'presenter': {
        'title': 'Презентер: порядок служения',
        'summary': 'Проверка готовности сцены, тайминга и коммуникации перед началом служения.',
        'content': 'Перед началом служения проверь сценарий, объявленные блоки и готовность сцены. Держи контакт с командой эфира и звука, чтобы переходы шли без пауз и накладок.',
        'checklist': [
            'Проверить порядок служения и объявления.',
            'Согласовать сигналы с эфирной командой.',
            'Уточнить особые моменты у лидера служения.',
            'Быть готовым к выходу за 5 минут до начала.',
        ],
    },
    'livestream': {
        'title': 'Трансляция: контроль эфира',
        'summary': 'Запуск, мониторинг и завершение эфира без потери сигнала.',
        'content': 'Оператор трансляции отвечает за стабильный эфир, корректный выбор площадок, старт записи и постоянный контроль состояния стрима до полного завершения.',
        'checklist': [
            'Проверить интернет и кодировщик.',
            'Проверить ключи и площадки трансляции.',
            'Запустить тестовый сигнал и убедиться в наличии звука.',
            'Во время эфира контролировать статус стрима и качество картинки.',
            'Корректно завершить трансляцию и запись.',
        ],
    },
    'atem': {
        'title': 'ATEM Mini: видеомикшер',
        'summary': 'Подготовка источников, сцен и переходов на видеомикшере.',
        'content': 'Перед эфиром проверь входы, мультивью, сцены и ключевые переходы. Во время служения следи за чистотой переключений и соответствием происходящему на сцене.',
        'checklist': [
            'Подключить и проверить все видеоисточники.',
            'Проверить мультивью и превью/программный выход.',
            'Подготовить основные планы и графику.',
            'Согласовать переходы с режиссёром или ведущим эфира.',
        ],
    },
    'light': {
        'title': 'Свет: подготовка сцены',
        'summary': 'Проверка световых сцен и ручного управления перед служением.',
        'content': 'Ответственный за свет проверяет базовые сцены, акценты, фронтальный и задний свет. Во время служения следит, чтобы свет не мешал кадру и атмосфере зала.',
        'checklist': [
            'Включить световую систему и проверить связь с контроллером.',
            'Проверить основные сцены и переходы.',
            'Согласовать особенности с видеокомандой.',
            'Во время служения следить за стабильностью света.',
        ],
    },
    'camera1': {
        'title': 'Камера 1: основной план',
        'summary': 'Контроль главного плана, композиции и устойчивости кадра.',
        'content': 'Оператор главной камеры отвечает за стабильный общий и средний планы, аккуратную композицию и готовность к ключевым моментам служения.',
        'checklist': [
            'Проверить питание, карту памяти и сигнал камеры.',
            'Настроить баланс белого и экспозицию.',
            'Подготовить основные планы сцены и зала.',
            'Следить за устойчивостью кадра и указаниями режиссёра.',
        ],
    },
    'camera2': {
        'title': 'Камера 2: дополнительный план',
        'summary': 'Детали, крупные планы и поддержка режиссуры кадра.',
        'content': 'Дополнительная камера усиливает эфир деталями: реакциями, инструментами, крупными планами. Важно не дублировать основной план без необходимости.',
        'checklist': [
            'Проверить камеру и канал связи с режиссёром.',
            'Подготовить альтернативные точки съёмки.',
            'Следить за артистами, инструментами и реакциями зала.',
            'Не пересекать рабочую зону основной камеры.',
        ],
    },
    'sound': {
        'title': 'Звук: подготовка трансляции',
        'summary': 'Полный рабочий чек-лист для звукового оператора трансляции.',
        'content': 'Звуковой оператор отвечает не только за баланс, но и за факт наличия сигнала в эфирных каналах. До, во время и после служения нужно пройти полный цикл проверки.',
        'checklist': [
            'Включить пульт.',
            'Подключить устройство управления и проверить управление.',
            'Включить мониторы для звука.',
            'Проверить прохождение сигналов на каждом канале.',
            'Подключиться к приложению ATEM Software Control.',
            'Проверить синхронизацию видео и аудио, при необходимости скорректировать задержку в канале микрофона.',
            'Уточнить у звукорежиссёра или лидера прославления изменения в составе и инструментах.',
            'На саундчеке настроить баланс звука.',
            'Во время трансляции постоянно контролировать звук в каналах YouTube, VK1 и VK2.',
            'По окончании трансляции выключить мониторы и пульт.',
            'Навести порядок на рабочем столе.',
        ],
    },
}


def ensure_default_guides(db: Session) -> list[InstructionGuide]:
    positions = ensure_default_positions(db)
    guides = db.query(InstructionGuide).all()
    guide_map = {guide.position_id: guide for guide in guides}
    created = False

    for position in positions:
        template = DEFAULT_GUIDES.get(position.code, {
            'title': f'{position.name}: инструкция',
            'summary': f'Базовый инструктаж для позиции {position.name}.',
            'content': f'Подготовь рабочее место, проверь оборудование и держи связь с командой на позиции {position.name}.',
            'checklist': ['Проверить оборудование.', 'Уточнить задачи на служение.', 'Подготовить рабочее место.'],
        })
        guide = guide_map.get(position.id)
        if guide:
            continue
        guide = InstructionGuide(
            position_id=position.id,
            title=str(template['title']),
            summary=str(template.get('summary') or ''),
            content=str(template['content']),
            checklist=_make_checklist(template['checklist']),
        )
        db.add(guide)
        created = True

    if created:
        db.commit()
    return db.query(InstructionGuide).all()


def build_instruction_payload(db: Session, current_user: User) -> InstructionCollectionRead:
    ensure_default_guides(db)
    service_date = get_effective_service_date(db)
    week = ensure_service_week(db, service_date)
    assignments = db.query(WeeklyAssignment).filter(WeeklyAssignment.week_id == week.week_id).all()
    assigned_positions = {
        assignment.position_id
        for assignment in assignments
        if assignment.user_id == current_user.id or assignment.partner_user_id == current_user.id
    }

    guides = (
        db.query(InstructionGuide, Position)
        .join(Position, Position.id == InstructionGuide.position_id)
        .filter(Position.is_active == True)
        .order_by(Position.sort_order.asc())
        .all()
    )
    progress_rows = (
        db.query(InstructionProgress)
        .filter(
            InstructionProgress.user_id == current_user.id,
            InstructionProgress.service_date == service_date,
        )
        .all()
    )
    progress_map = {row.instruction_id: row for row in progress_rows}

    items: list[InstructionRead] = []
    for guide, position in guides:
        progress = progress_map.get(guide.id)
        items.append(
            InstructionRead(
                id=guide.id,
                position_id=position.id,
                position_code=position.code,
                position_name=position.name,
                position_sort_order=position.sort_order,
                title=guide.title,
                summary=guide.summary,
                content=guide.content,
                checklist=[ChecklistItem(**item) for item in (guide.checklist or [])],
                checked_item_ids=list(progress.checked_item_ids or []) if progress else [],
                assigned_to_me=position.id in assigned_positions,
                updated_at=guide.updated_at,
            )
        )

    items.sort(key=lambda item: (0 if item.assigned_to_me else 1, item.position_sort_order, item.position_name.lower()))
    return InstructionCollectionRead(service_date=service_date, items=items)


def update_instruction(db: Session, instruction_id: int, payload: InstructionUpdate) -> None:
    guide = db.get(InstructionGuide, instruction_id)
    if not guide:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Инструктаж не найден')

    title = payload.title.strip()
    content = payload.content.strip()
    summary = (payload.summary or '').strip() or None
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Заголовок не может быть пустым')
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Основной текст не может быть пустым')

    guide.title = title
    guide.summary = summary
    guide.content = content
    guide.checklist = _normalize_checklist(payload.checklist)
    db.add(guide)
    db.commit()


def update_instruction_progress(db: Session, instruction_id: int, current_user: User, checked_item_ids: list[str]) -> None:
    guide = db.get(InstructionGuide, instruction_id)
    if not guide:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Инструктаж не найден')

    service_date = get_effective_service_date(db)
    allowed_ids = {item['id'] for item in (guide.checklist or []) if item.get('id')}
    invalid_ids = [item_id for item_id in checked_item_ids if item_id not in allowed_ids]
    if invalid_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Часть пунктов чек-листа недействительна')

    progress = (
        db.query(InstructionProgress)
        .filter(
            InstructionProgress.instruction_id == instruction_id,
            InstructionProgress.user_id == current_user.id,
            InstructionProgress.service_date == service_date,
        )
        .first()
    )
    if not progress:
        progress = InstructionProgress(
            instruction_id=instruction_id,
            user_id=current_user.id,
            service_date=service_date,
            checked_item_ids=list(dict.fromkeys(checked_item_ids)),
        )
    else:
        progress.checked_item_ids = list(dict.fromkeys(checked_item_ids))
    db.add(progress)
    db.commit()


def _make_checklist(items: list[str]) -> list[dict[str, str]]:
    return [{'id': uuid4().hex[:10], 'text': item.strip()} for item in items if item.strip()]


def _normalize_checklist(items: list[ChecklistItem]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    for item in items:
        text = item.text.strip()
        if not text:
            continue
        normalized.append({'id': item.id or uuid4().hex[:10], 'text': text})
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Нужно оставить хотя бы один пункт чек-листа')
    return normalized
