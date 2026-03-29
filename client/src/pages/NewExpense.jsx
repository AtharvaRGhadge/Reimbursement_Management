import { Navigate } from 'react-router-dom';

/** Expenses are edited in the employee workspace at `/expenses` (with Upload / New). */
export default function NewExpense() {
  return <Navigate to="/expenses?new=1" replace />;
}
