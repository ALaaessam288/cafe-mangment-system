import './Spinner.css';

export default function Spinner({ size = 'md', color = 'accent', className = '' }) {
  return (
    <span
      className={`spinner spinner--${size} spinner--${color} ${className}`}
      aria-label="Loading..."
      role="status"
    />
  );
}
