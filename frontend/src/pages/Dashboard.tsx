// --- src/pages/Dashboard.tsx ---
import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { AdminDashboard }from './AdminDashboard';
import { TeacherDashboard } from './TeacherDashboard';
import { StudentDashboard } from './StudentDashboard';

export const Dashboard = () => {
  const { user } = useContext(AuthContext);
  if (!user) return null;

  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
};