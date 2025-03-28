// Change fields !!!

// src/api/Auth.ts


export interface RegisterFormData {
    first_name: string;
    second_name?: string;
    username: string;
    role: "student" | "teacher";
    password: string;
    image_data?: {
      image: string;
      file_name: string;
    };
}
  
  // Интерфейс для ответа сервера (предполагаемый, исходя из UserResponse)
export interface UserResponse {
    id?: number;
    first_name: string;
    second_name: string;
    username: string;
    role: "student" | "teacher";
    image_path: string;
  }
  
  


export interface LoginData {
    username: string;
    password: string;
}