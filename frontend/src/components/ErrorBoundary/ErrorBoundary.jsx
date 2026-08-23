import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Catches render-time crashes and shows a way out.
 *
 * Caffio runs as a packaged desktop app: there is no devtools console to look at, no URL bar to
 * retype, and no browser refresh button. Without a boundary, a single thrown error during render
 * unmounts the whole tree and leaves a cashier staring at a white rectangle mid-shift, whose only
 * recourse is force-quitting the app. This turns that into a screen that says what happened, keeps
 * the details available for whoever gets called over, and offers one tap back to the till.
 *
 * Must be a class - React has no hook equivalent of componentDidCatch.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Surfaces in the Electron main process log (main.js pipes renderer console output to
    // backend.log), which is what support will ask for.
    console.error('[UI CRASH]', error, info?.componentStack);
  }

  handleReload = () => {
    // Full reload rather than clearing state: whatever produced the bad render may have left other
    // state inconsistent, and the cashier's work is on the server, not in memory.
    window.location.assign('/pos');
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash__card">
          <div className="crash__icon" aria-hidden="true">⚠</div>

          <h1 className="crash__title">حصلت مشكلة في الشاشة</h1>
          <p className="crash__body">
            الأوردرات والفواتير كلها متسجلة ومحفوظة — مفيش حاجة ضاعت.
            دوس على الزرار تحت وارجع لشاشة الكاشير.
          </p>

          <button type="button" className="crash__button" onClick={this.handleReload}>
            رجوع لشاشة الكاشير
          </button>

          <details className="crash__details">
            <summary>تفاصيل للدعم الفني</summary>
            <pre className="crash__trace">
              {String(error?.message || error)}
              {info?.componentStack ? `\n${info.componentStack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
