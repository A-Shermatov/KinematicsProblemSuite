import axios from 'axios';
import { RegisterData, LoginData } from '../types/Auth';
const API_AUTH_HOST = 'http://127.0.0.1';
const API_AUTH_PORT = 8001;
const API_AUTH_PREFIX = "v1/auth";

export const registerUser = async (data: RegisterData) => {
  try {
    const response = await axios.post(
      `${API_AUTH_HOST}:${API_AUTH_PORT}/${API_AUTH_PREFIX}/register`, 
      data,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (data: LoginData) => {
  try {
    const response = await axios.post(`${API_AUTH_HOST}:${API_AUTH_PORT}/auth/login`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};