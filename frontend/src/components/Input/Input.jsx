import { forwardRef, useId } from 'react';
import './Input.css';

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    size = 'md',
    className = '',
    id,
    required,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || `input-${generatedId}`;

  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={inputId}>
          {label}
          {required && <span className="field__required" aria-hidden>*</span>}
        </label>
      )}
      <div className={`field__wrapper field__wrapper--${size} ${error ? 'field__wrapper--error' : ''}`}>
        {leftIcon && <span className="field__icon field__icon--left">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`field__input ${leftIcon ? 'field__input--pl' : ''} ${rightIcon ? 'field__input--pr' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          required={required}
          {...props}
        />
        {rightIcon && <span className="field__icon field__icon--right">{rightIcon}</span>}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;
