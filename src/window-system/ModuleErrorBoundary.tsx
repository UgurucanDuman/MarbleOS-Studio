import { Component, type ReactNode } from 'react';

export class ModuleErrorBoundary extends Component<
  { title: string; children: ReactNode }, { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mod-pane">
        <h3>{this.props.title} açılamadı</h3>
        <p>Diğer pencerelerde çalışmaya devam edebilirsiniz. Kaydedilmemiş değişiklikleri kontrol edin.</p>
        <button type="button" className="mod-secondary-btn" onClick={() => this.setState({ failed: false })}>
          Bu pencereyi yeniden dene
        </button>
      </div>
    );
  }
}
