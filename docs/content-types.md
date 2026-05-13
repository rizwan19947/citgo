# Content Types in a Headless DotCMS Project

## What Are Content Types?

In a headless DotCMS architecture, **content types** are backend-defined data schemas (like database tables) that editors populate through the DotCMS admin. The frontend (this Next.js app) renders each content type with a dedicated React component.

The bridge between backend and frontend is the **component registry** — a simple JS object that maps content type variable names to React components.

## How It Works in This Project

### 1. The Registry (`components/content-types/index.ts`)

```ts
import Banner from "./Banner";
import WebPageContent from "./WebPageContent";

export const pageComponents = {
  Banner: Banner,
  webPageContent: WebPageContent,
};
```

- Keys **must exactly match** the Content Type Variable name in DotCMS (case-sensitive)
- `DotCMSLayoutBody` (in `views/Page.tsx`) loops over each contentlet on a page, looks up its `contentType` field in this map, and renders the matching component
- If no match is found, nothing renders (or a fallback component if one is registered)

### 2. Component Contract

Every content-type component receives **the full contentlet object as props**. The prop names map 1:1 to the field variable names defined in the DotCMS content type.

```tsx
// A simple content type with fields: title (Text), body (Block Editor), image (Binary)
function MyContentType({ title, body, image, identifier }: any) {
  return (
    <div>
      <h2>{title}</h2>
      {body && <DotBlockEditor blocks={body} />}
      {image && <Image src={`/dA/${identifier}/image`} ... />}
    </div>
  );
}
```

### 3. Field Type → React Rendering Cheatsheet

| DotCMS Field Type       | Prop Shape                          | How to Render                                      |
|------------------------|-------------------------------------|---------------------------------------------------|
| **Text**               | `string`                            | Direct JSX `{title}`                               |
| **Rich Text / WYSIWYG**| `string` (HTML)                     | `dangerouslySetInnerHTML` or parser                |
| **Block Editor**       | `object` (ProseMirror JSON)         | `<DotBlockEditor blocks={field} />`                |
| **Binary / Image**     | `string` (identifier)               | `<Image src={/dA/${identifier}/image} />`          |
| **File**               | `{ idPath, identifier, ... }`       | `<Image src={file.idPath} />`                      |
| **Relationship**       | `object[]` (array of contentlets)   | Map and render each item                           |
| **Category**           | `object[]`                          | `Object.values(category[0])[0]` for first value   |
| **Tag**                | `string` or `string[]`              | Direct render or `.map()`                          |
| **Date**               | `string` (ISO)                      | Parse with `new Date()` or formatter               |
| **Select / Radio**     | `string`                            | Use as key for style/layout maps                   |
| **Checkbox / Toggle**  | `string` ("true"/"false")           | Use `checkTruthyValue()` helper to get boolean     |
| **Key/Value**          | `object`                            | Access as `field.key`                              |
| **Custom Field**       | `string` (often JSON)               | `JSON.parse()` then render                         |

### 4. Layout Pattern

When a content type supports multiple visual presentations, use a layout selector:

```tsx
const layouts = { 1: Layout01, 2: Layout02, 3: Layout03 };

function MyComponent(props) {
  const Layout = layouts[props.layout] || Layout01;
  return <Layout {...props} />;
}
```

The `layout` field is typically a select/radio field on the content type in DotCMS.

### 5. Image Handling

This project uses a custom `ImageLoader` (`utils/imageLoader.ts`) that routes through DotCMS's `/dA/` asset API for on-the-fly resizing:

```tsx
import Image from "next/image";

// By identifier (binary field)
<Image src={`/dA/${identifier}/image`} loader={ImageLoader} ... />

// By file asset path
<Image src={fileAsset.idPath} loader={ImageLoader} ... />
```

### 6. Block Editor Rendering

Rich content from DotCMS's Block Editor arrives as ProseMirror JSON. Render it with custom node renderers:

```tsx
<DotBlockEditor
  blocks={bodyField}
  customRenderers={{
    paragraph: MyParagraph,
    heading: MyHeading,
    listItem: MyListItem,
  }}
/>
```

### 7. Common Shared Props

These props appear on most contentlets automatically (injected by DotCMS):

- `identifier` — unique content ID, used for image URLs (`/dA/{identifier}`)
- `contentType` — the content type variable name
- `_map` — contains relationship fields (e.g., `_map.image.identifier`)
- `languageId` — content language
- `modDate` / `publishDate` — timestamps

### 8. Adding a New Content Type

1. Create `components/content-types/MyType.tsx`
2. Destructure the props matching the DotCMS field variable names
3. Import and add to the registry in `components/content-types/index.ts`
4. The component will automatically render wherever that content type appears on a DotCMS page
