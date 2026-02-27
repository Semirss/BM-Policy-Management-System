/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'bg-primary': 'var(--bg-primary)',
                'bg-secondary': 'var(--bg-secondary)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'border-color': 'var(--border-color)',
                'accent': 'var(--accent-color)',
                'accent-hover': 'var(--accent-hover)',
                'danger': 'var(--danger)',
                'danger-bg': 'var(--danger-bg)',
                'danger-border': 'var(--danger-border)',
                'success': 'var(--success)',
            },
            fontFamily: {
                'dosis': ['Dosis', 'sans-serif']
            }
        },
    },
    plugins: [],
}
