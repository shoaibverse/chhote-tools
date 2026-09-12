declare module "*.mjs?url" {
  const src: string;
  export default src;
}

declare module "mammoth/mammoth.browser" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>;
  const mammoth: {
    extractRawText: typeof extractRawText;
  };
  export default mammoth;
}
