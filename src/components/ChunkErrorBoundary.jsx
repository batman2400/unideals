import { Component } from "react";
import {
  clearChunkReloadFlag,
  isChunkLoadError,
  reloadForStaleChunk,
} from "../lib/chunkReload";

export default class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      reloadForStaleChunk();
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const staleChunk = isChunkLoadError(error);

    return (
      <section className="max-w-[760px] mx-auto px-6 py-16 text-center">
        <h1 className="font-headline font-extrabold text-3xl text-on-background mb-2">
          {staleChunk ? "This page needs a refresh" : "Something went wrong"}
        </h1>
        <p className="text-on-surface-variant mb-6 max-w-md mx-auto">
          {staleChunk
            ? "A new version of Uni Deals was published while this tab stayed open, so an old file could not be loaded."
            : "Reload the page to keep going."}
        </p>
        <button
          type="button"
          onClick={() => {
            clearChunkReloadFlag();
            window.location.reload();
          }}
          className="px-6 py-2.5 bg-primary text-on-primary font-headline font-bold rounded-xl hover:bg-primary/90 transition-all"
        >
          Reload
        </button>
      </section>
    );
  }
}
