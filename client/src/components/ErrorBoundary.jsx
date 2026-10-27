import { Component } from 'react';

// Shows a readable message instead of a blank page if a screen crashes.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-lg rounded-xl bg-white p-6 ring-1 ring-red-200">
            <h1 className="text-lg font-semibold text-red-800">Something went wrong on this page</h1>
            <p className="mt-2 text-sm text-slate-600">
              Refresh the page. If it happens again, send the message below to the developer.
            </p>
            <pre className="mt-3 overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
