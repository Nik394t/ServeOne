from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.birthday import BirthdayProfile
from app.models.broadcast import BroadcastCampaign, BroadcastRecipient, InboxMessage
from app.models.user import User, UserRole
from app.schemas.broadcast import (
    BirthdayOptionRead,
    BroadcastCollectionRead,
    BroadcastHistoryRead,
    BroadcastSendPayload,
)
from app.schemas.user import UserRead
from app.services.birthday import _next_birthday
from app.services.push import send_push_to_users
from app.core.config import get_settings

RU_MONTHS = {
    1: 'января',
    2: 'февраля',
    3: 'марта',
    4: 'апреля',
    5: 'мая',
    6: 'июня',
    7: 'июля',
    8: 'августа',
    9: 'сентября',
    10: 'октября',
    11: 'ноября',
    12: 'декабря',
}


def build_broadcast_payload(db: Session) -> BroadcastCollectionRead:
    users = _get_active_users(db)
    user_map = {user.id: user for user in users}
    profiles = {profile.user_id: profile for profile in db.query(BirthdayProfile).all()}

    birthday_people: list[BirthdayOptionRead] = []
    for user in users:
        profile = profiles.get(user.id)
        if not profile:
            continue
        birthday_people.append(
            BirthdayOptionRead(
                user_id=user.id,
                display_name=_user_name(user),
                birth_date=profile.birth_date.isoformat(),
                genitive_name=profile.genitive_name,
                address_form=profile.address_form,
            )
        )
    birthday_people.sort(key=lambda item: item.display_name.lower())

    campaigns = db.query(BroadcastCampaign).order_by(BroadcastCampaign.created_at.desc(), BroadcastCampaign.id.desc()).limit(20).all()
    history: list[BroadcastHistoryRead] = []
    for campaign in campaigns:
        recipients = db.query(BroadcastRecipient).filter(BroadcastRecipient.campaign_id == campaign.id).all()
        recipient_names = []
        for recipient in recipients:
            user = user_map.get(recipient.user_id) or db.get(User, recipient.user_id)
            if user:
                recipient_names.append(_user_name(user))
        sender = user_map.get(campaign.created_by_user_id) if campaign.created_by_user_id else None
        if campaign.created_by_user_id and sender is None:
            sender = db.get(User, campaign.created_by_user_id)
        history.append(
            BroadcastHistoryRead(
                id=campaign.id,
                kind=campaign.kind,
                title=campaign.title,
                body=campaign.body,
                target_mode=campaign.target_mode,
                created_at=campaign.created_at,
                created_by_user_name=_user_name(sender) if sender else None,
                recipient_count=len(recipient_names),
                recipients=recipient_names,
            )
        )

    return BroadcastCollectionRead(
        users=[UserRead.model_validate(user, from_attributes=True) for user in users],
        birthday_people=birthday_people,
        history=history,
    )


def send_broadcast(db: Session, current_user: User, payload: BroadcastSendPayload) -> tuple[int, int]:
    recipients = _resolve_recipients(db, payload)
    if not recipients:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='После фильтрации не осталось получателей')

    title, body, meta = _compose_campaign(db, payload)
    campaign = BroadcastCampaign(
        kind=payload.kind,
        title=title,
        body=body,
        target_mode=payload.target_mode,
        meta=meta,
        created_by_user_id=current_user.id,
    )
    db.add(campaign)
    db.flush()

    for user in recipients:
        db.add(BroadcastRecipient(campaign_id=campaign.id, user_id=user.id))
        db.add(
            InboxMessage(
                user_id=user.id,
                sender_user_id=current_user.id,
                source_type='broadcast',
                title=title,
                body=body,
                is_read=False,
            )
        )

    db.commit()
    send_push_to_users(
        db,
        user_ids=[user.id for user in recipients],
        title=title,
        body=body,
        url='/dashboard/messages',
        settings=get_settings(),
    )
    return campaign.id, len(recipients)


def _get_active_users(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.is_active == True, User.role != UserRole.DELETED.value)
        .order_by(User.full_name.asc(), User.login.asc())
        .all()
    )


def _resolve_recipients(db: Session, payload: BroadcastSendPayload) -> list[User]:
    users = _get_active_users(db)

    if payload.target_mode == 'all':
        selected = users
    elif payload.target_mode == 'users':
        selected = [user for user in users if user.role == UserRole.USER.value]
    elif payload.target_mode == 'admins':
        selected = [user for user in users if user.role in {UserRole.ADMIN.value, UserRole.CREATOR.value}]
    else:
        if not payload.selected_user_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Нужно выбрать хотя бы одного получателя')
        selected_ids = set(payload.selected_user_ids)
        selected = [user for user in users if user.id in selected_ids]

    excluded_ids = set(payload.excluded_user_ids)
    if payload.kind == 'birthday_gift' and payload.birthday_user_id:
        excluded_ids.add(payload.birthday_user_id)

    filtered = [user for user in selected if user.id not in excluded_ids]
    return filtered


def _compose_campaign(db: Session, payload: BroadcastSendPayload) -> tuple[str, str, dict]:
    if payload.kind == 'general':
        title = (payload.title or '').strip()
        body = (payload.body or '').strip()
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Заголовок рассылки обязателен')
        if not body:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Текст рассылки обязателен')
        return title, body, {
            'kind': 'general',
            'excluded_user_ids': payload.excluded_user_ids,
            'selected_user_ids': payload.selected_user_ids,
        }

    birthday_user_id = payload.birthday_user_id
    if not birthday_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Для сценария сбора на подарок нужно выбрать именинника')

    birthday_user = db.get(User, birthday_user_id)
    profile = db.query(BirthdayProfile).filter(BirthdayProfile.user_id == birthday_user_id).first()
    if not birthday_user or birthday_user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Именинник не найден')

    address_form = payload.address_form or (profile.address_form if profile else None) or 'brother'
    genitive_name = (profile.genitive_name if profile and profile.genitive_name else _user_name(birthday_user)).strip()
    next_birthday = _next_birthday(profile.birth_date, date.today()) if profile and profile.birth_date else None
    title = f'Сбор на подарок для {_user_name(birthday_user)}'
    body = _build_birthday_gift_text(
        genitive_name=genitive_name,
        address_form=address_form,
        next_birthday=next_birthday,
        card_number=(payload.card_number or '').strip() or None,
        sbp_phone=(payload.sbp_phone or '').strip() or None,
        bank_name=(payload.bank_name or '').strip() or None,
        recipient_name=(payload.recipient_name or '').strip() or None,
        extra_note=(payload.extra_note or '').strip() or None,
    )
    return title, body, {
        'kind': 'birthday_gift',
        'birthday_user_id': birthday_user_id,
        'address_form': address_form,
        'card_number': payload.card_number,
        'sbp_phone': payload.sbp_phone,
        'bank_name': payload.bank_name,
        'recipient_name': payload.recipient_name,
        'extra_note': payload.extra_note,
        'excluded_user_ids': sorted(set(payload.excluded_user_ids + [birthday_user_id])),
        'selected_user_ids': payload.selected_user_ids,
    }


def _build_birthday_gift_text(
    *,
    genitive_name: str,
    address_form: str,
    next_birthday: date | None,
    card_number: str | None,
    sbp_phone: str | None,
    bank_name: str | None,
    recipient_name: str | None,
    extra_note: str | None,
) -> str:
    relation = 'нашего брата' if address_form == 'brother' else 'нашу сестру'
    lines = [f'💛 Друзья, совсем скоро в нашей медиа-команде день рождения у {genitive_name}.']
    if next_birthday:
        lines.append(f'Дата: {_format_ru_full_date(next_birthday)} ({next_birthday.strftime("%d.%m")}).')
    lines.append('')
    lines.append(f'Давайте почтим {relation} и соберём на подарок: можно принести сумму в конверт или перевести заранее.')

    payment_lines = []
    if card_number:
        payment_lines.append(f'• Карта: {card_number}')
    if sbp_phone:
        sbp_suffix = []
        if bank_name:
            sbp_suffix.append(bank_name)
        if recipient_name:
            sbp_suffix.append(recipient_name)
        suffix = f" ({', '.join(sbp_suffix)})" if sbp_suffix else ''
        payment_lines.append(f'• СБП: {sbp_phone}{suffix}')

    if payment_lines:
        lines.append('')
        lines.append('Если есть на сердце поучаствовать:')
        lines.extend(payment_lines)

    lines.append('')
    lines.append('Пожалуйста, подпишите перевод: «подарок». Спасибо за единство и любовь в команде.')
    if extra_note:
        lines.append('')
        lines.append(extra_note)
    return '\n'.join(lines)


def _format_ru_full_date(value: date) -> str:
    return f'{value.day} {RU_MONTHS[value.month]} {value.year}'


def _user_name(user: User | None) -> str:
    if not user:
        return 'Неизвестный пользователь'
    return user.full_name or user.login
