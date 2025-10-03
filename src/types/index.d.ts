declare namespace React {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    webkitdirectory?: string;
    mozdirectory?: string;
    directory?: string;
  }
}