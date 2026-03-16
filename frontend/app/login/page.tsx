import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fdfefe,_#eef3f8_42%,_#dce5f1_100%)] px-4 py-8">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="hidden rounded-[32px] border border-white/70 bg-[#18304f] p-8 text-white shadow-shell lg:block xl:p-10">
          <p className="text-xs uppercase tracking-[0.28em] text-white/60">ServeOne</p>
          <h2 className="mt-6 max-w-xl text-5xl font-semibold leading-tight">
            Единое рабочее пространство для медиа-команды.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-8 text-white/72">
            Служения, ротация, инструктажи, дни рождения, рассылки и управление командой в одном интерфейсе без перегрузки.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {[
              'Адаптивный интерфейс для ПК, планшетов и телефонов',
              'Строгий UI с быстрым доступом к ключевым модулям',
              'Роли Creator, Admin и User',
              'Готовность к PWA и push-уведомлениям'
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/12 bg-white/8 p-4 text-sm leading-6 text-white/80">
                {item}
              </div>
            ))}
          </div>
        </div>
        <LoginForm nextPath="/dashboard" />
      </div>
    </div>
  );
}
