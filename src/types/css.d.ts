// Type declarations for CSS imports used by the web build.
// Metro/Next handle these at bundle time; TypeScript needs to be told they exist.
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css";
