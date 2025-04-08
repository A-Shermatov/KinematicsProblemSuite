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

export interface LoginData {
  username: string;
  password: string;
}