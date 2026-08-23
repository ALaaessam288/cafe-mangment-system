import { Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import './ObserverBanner.css';

/**
 * A banner displayed at the top of management pages when the logged-in user
 * is ADMIN (view-only / observer mode). Reminds the admin that CRUD
 * operations are handled by supervisors.
 */
export default function ObserverBanner() {
  const { role } = useAuth();
  if (role !== ROLES.ADMIN) return null;

  return (
    <div className="observer-banner">
      <Eye size={16} className="observer-banner__icon" />
      <span className="observer-banner__text">
        👁️ وضع المراقبة — أنت تشاهد البيانات فقط. مدير العمليات (المشرف) مسؤول عن الإضافة والتعديل والحذف.
      </span>
    </div>
  );
}
