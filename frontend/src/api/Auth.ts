import axios, { AxiosResponse } from 'axios';
import { RegisterFormData, LoginData, UserResponse } from '../types/Auth';
const API_AUTH_HOST = 'http://127.0.0.1';
const API_AUTH_PORT = 8001;
const API_AUTH_PREFIX = "v1/auth";


export const registerUser = async (data: RegisterFormData): Promise<AxiosResponse<UserResponse>> => {
  try {
    return await axios.post(`${API_AUTH_HOST}:${API_AUTH_PORT}/${API_AUTH_PREFIX}/register`, data); // Замените URL на ваш endpoint
  } catch (error) {
    throw error;
  }
};


export const loginUser = async (data: LoginData) => {
  try {
    const response = await axios.post(`${API_AUTH_HOST}:${API_AUTH_PORT}/${API_AUTH_PREFIX}/login`, data);
    return response;
  } catch (error) {
    throw error;
  }
};