/**
 * LaTeX utility functions for escaping and formatting
 */

/**
 * Escapes special LaTeX characters in a string.
 * @param str The input string.
 * @returns The escaped string.
 */
export const escapeLatex = (str: string | undefined): string => {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
};

/**
 * Ensures a URL has proper protocol and formats it for LaTeX hyperref.
 * @param url The input URL.
 * @returns A properly formatted URL.
 */
export const formatUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    // Trim whitespace
    url = url.trim();
    
    // Add https:// if no protocol is present
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // URLs in LaTeX hyperref should not be escaped, but we need to handle % specially
    return url.replace(/%/g, '\\%');
};

/**
 * Creates a LaTeX hyperlink with proper formatting
 * @param url The URL to link to
 * @param displayText The text to display
 * @returns LaTeX hyperlink command
 */
export const createHyperlink = (url: string, displayText: string): string => {
    return `\\href{${formatUrl(url)}}{${escapeLatex(displayText)}}`;
};

/**
 * Creates a mailto hyperlink for email addresses
 * @param email The email address
 * @returns LaTeX mailto hyperlink
 */
export const createEmailLink = (email: string): string => {
    return `\\href{mailto:${escapeLatex(email)}}{${escapeLatex(email)}}`;
};

/**
 * Joins LaTeX elements with line breaks
 * @param elements Array of LaTeX elements
 * @returns Joined string with LaTeX line breaks
 */
export const joinWithLineBreaks = (elements: string[]): string => {
    return elements.filter(element => element.trim()).join(' \\\\ ');
};