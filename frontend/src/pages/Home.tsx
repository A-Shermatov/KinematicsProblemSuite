// --- src/pages/Home.tsx ---
import React from 'react';
import { Link } from 'react-router-dom';

export const Home = () => (
  <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 flex flex-col items-center justify-center p-4 pt-20">
    <div className="text-center max-w-4xl animate-fade-in">
      <h1 className="text-5xl font-extrabold text-gray-800 mb-4 tracking-tight md:text-6xl">
        Kinematics Problem Suite
      </h1>
      <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed md:text-2xl">
        Добро пожаловать на платформу для изучения кинематики! Решайте увлекательные задачи, создавайте свои и отслеживайте свой прогресс в реальном времени.
      </p>
      <Link
        to="/themes"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-300 shadow-md"
      >
        Начать решать задачи
      </Link>
    </div>
    <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 max-w-5xl w-full px-4">
      <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Изучайте кинематику</h3>
        <p className="text-gray-600">
          Решайте задачи по основам кинематики.
        </p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Создавайте задачи</h3>
        <p className="text-gray-600">
          Учителя могут создавать свои задачи для обучения учеников.
        </p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Отслеживайте прогресс</h3>
        <p className="text-gray-600">
          Следите за своими успехами с помощью статистики в личном кабинете и анализируйте свои попытки.
        </p>
      </div>
    </div>
  </div>
);