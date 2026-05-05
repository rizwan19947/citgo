/*
 * GraphQL query fragments used when fetching pages from DotCMS.
 * navigationQuery — fetches the site's root navigation tree 2 levels deep
 *                   (top-level items + their direct children).
 * fragmentNav     — reusable fragment that defines which fields to pull for
 *                   each nav item (title, href, type, etc.).
 */

export const navigationQuery = `
DotNavigation(uri: "/", depth: 2) {
    ...NavProps
    children {
        ...NavProps
    }
}
`;

export const fragmentNav = `
fragment NavProps on DotNavigation {
    code
    folder
    hash
    host
    href
    languageId
    order
    target
    title
    type
}
`;
