/**
 * Название платформы в одном месте. Чтобы переименовать — поменяйте значения здесь
 * (или задайте VITE_APP_NAME при сборке) и заголовки в index.html обоих приложений.
 */
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) ?? "Donish";
export const APP_TAGLINE = "задачи и олимпиады по физике, математике и не только";
