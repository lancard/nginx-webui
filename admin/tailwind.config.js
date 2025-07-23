import daisyui from 'daisyui';

export default {
    content: ["./src/**/*.{html,js}"],
    theme: {
        extend: {},
    },
    plugins: [daisyui, require('@tailwindcss/typography')],
};
