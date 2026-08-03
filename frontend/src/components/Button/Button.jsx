import Spinner from '../Spinner/Spinner';
import './Button.css';

/**
 * Reusable Button component.
 * @param {'primary'|'secondary'|'ghost'|'danger'|'success'} variant
 * @param {'sm'|'md'|'lg'} size
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" color="white" />
      ) : (
        leftIcon && <span className="btn__icon btn__icon--left">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!loading && rightIcon && (
        <span className="btn__icon btn__icon--right">{rightIcon}</span>
      )}
    </button>
  );
}
