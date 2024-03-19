require("core.opts")
require("core.keymaps")
require("core.autocommands")

-- [[ Install `lazy.nvim` plugin manager ]]
--    See `:help lazy.nvim.txt` or https://github.com/folke/lazy.nvim for more info
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
	local lazyrepo = "https://github.com/folke/lazy.nvim.git"
	vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath })
end ---@diagnostic disable-next-line: undefined-field
vim.opt.rtp:prepend(lazypath)

-- [[ Configure and install plugins ]]
require("lazy").setup({
	-- Oneliners
	"tpope/vim-sleuth", -- Detect tabstop and shiftwidth automatically
	{ "numToStr/Comment.nvim", opts = {} },

	-- Bigger plugins
	require("plugins.gitsigns"),
	require("plugins.which-key"),
	require("plugins.telescope"),
	require("plugins.lspconfig"),
	require("plugins.conform"),
	require("plugins.cmp"),
	require("plugins.theme"),
	require("plugins.todo-comments"),
	require("plugins.mini"),
	require("plugins.treesitter"),

	-- More optional plugins
	require("plugins.vimtex"),

	--    For additional information, see `:help lazy.nvim-lazy.nvim-structuring-your-plugins`
	-- { import = 'custom.plugins' },
}, {
	ui = {
		-- If you are using a Nerd Font: set icons to an empty table which will use the
		-- default lazy.nvim defined Nerd Font icons, otherwise define a unicode icons table
		icons = vim.g.have_nerd_font and {} or {
			cmd = "⌘",
			config = "🛠",
			event = "📅",
			ft = "📂",
			init = "⚙",
			keys = "🗝",
			plugin = "🔌",
			runtime = "💻",
			require = "🌙",
			source = "📄",
			start = "🚀",
			task = "📌",
			lazy = "💤 ",
		},
	},
})

vim.g.vimtex_view_method = "zathura"
vim.g.vimtex_fold_enabled = true

-- The line beneath this is called `modeline`. See `:help modeline`
-- vim: ts=2 sts=2 sw=2 et
