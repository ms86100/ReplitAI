import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '1rem',
			screens: {
				'2xl': '960px'
			}
		},
		extend: {
			fontFamily: {
				'sans': ['Inter', 'Source Sans Pro', 'system-ui', 'sans-serif'],
				'heading': ['Source Sans Pro', 'Inter', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				
				// Brand tokens
				brand: {
					primary: 'hsl(var(--brand-primary))',
					'on-primary': 'hsl(var(--brand-on-primary))',
					accent: 'hsl(var(--brand-accent))'
				},
				
				// Airbus Design System Colors
				airbus: {
					primary: 'hsl(var(--brand-primary))',
					secondary: 'hsl(var(--secondary))',
					'secondary-dark': 'hsl(var(--secondary-hover))',
					light: 'hsl(var(--accent-light))'
				},
				
				// Surface tokens
				surface: {
					default: 'hsl(var(--surface-default))',
					alt: 'hsl(var(--surface-alt))',
					elevated: 'hsl(var(--surface-elevated))'
				},
				
				// Text tokens
				text: {
					primary: 'hsl(var(--text-primary))',
					muted: 'hsl(var(--text-muted))'
				},
				
				// Status tokens
				status: {
					success: 'hsl(var(--status-success))',
					warning: 'hsl(var(--status-warning))',
					info: 'hsl(var(--status-info))',
					error: 'hsl(var(--destructive))'
				},
				
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
					light: 'hsl(var(--primary-light))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					hover: 'hsl(var(--secondary-hover))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					light: 'hsl(var(--accent-light))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-card': 'var(--gradient-card)',
				'gradient-hero': 'var(--gradient-hero)',
			},
			spacing: {
				'xs': 'var(--spacing-xs)',
				'sm': 'var(--spacing-sm)', 
				'md': 'var(--spacing-md)',
				'lg': 'var(--spacing-lg)',
				'xl': 'var(--spacing-xl)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'radius-sm': 'var(--radius-sm)',
				'radius-md': 'var(--radius-md)',
				'radius-lg': 'var(--radius-lg)'
			},
			boxShadow: {
				'card': '0 1px 2px 0 hsl(221 39% 11% / 0.05)',
				'elevated': '0 2px 4px 0 hsl(221 39% 11% / 0.08)',
				'professional': '0 1px 3px 0 hsl(221 39% 11% / 0.08)'
			},
			keyframes: {
				// No animations - only keeping required ones for accessibility
			},
			animation: {
				// No animations - keeping interface static and stable
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
