import {Component} from 'react';
import type {ReactNode} from 'react';

export default class PluginBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() {return {failed: true};}
  render() {
    return this.state.failed ? <section role="alert"><h2>WholeCare could not load</h2><p>Refresh the page to try again. No live care action was submitted.</p></section> : this.props.children;
  }
}
