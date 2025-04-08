export interface Theme {
    id: number;
    title: string;
    description: string;
}

export interface Task {
    id: number;
    title: string;
    condition: string;

    user_id: number;
    theme_id: number;
    answer_id: number;
}

export interface User {
    id: number;
    username: string;
    role: "student" | "teacher" | "admin";
    image: string;
}