'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { DOMSerializer } from 'prosemirror-model';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Typography } from '@tiptap/extension-typography';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Youtube } from '@tiptap/extension-youtube';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import OrderedList from '@tiptap/extension-ordered-list';
import { Extension, Node } from '@tiptap/core';

const lowlight = createLowlight(common);

// Ordered List style types
export type OrderedListStyle = 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';
export const ORDERED_LIST_STYLES: { label: string; value: OrderedListStyle; preview: string }[] = [
  { label: 'Decimal', value: 'decimal', preview: '1, 2, 3' },
  { label: 'Lower Alpha', value: 'lower-alpha', preview: 'a, b, c' },
  { label: 'Upper Alpha', value: 'upper-alpha', preview: 'A, B, C' },
  { label: 'Lower Roman', value: 'lower-roman', preview: 'i, ii, iii' },
  { label: 'Upper Roman', value: 'upper-roman', preview: 'I, II, III' },
];

// Custom OrderedList extension with list-style-type attribute
const StyledOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style'),
        renderHTML: (attributes) => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setOrderedListStyle: (style: OrderedListStyle) => ({ commands }) => {
        return commands.updateAttributes('orderedList', { style: `list-style-type: ${style};` });
      },
    };
  },
});

import html2canvas from 'html2canvas';
import mammoth from 'mammoth';

import {
  Undo2, Redo2, Copy, ClipboardPaste, Clipboard,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, CodeXml,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Pilcrow,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks, Indent, Outdent,
  Quote, Minus, Table as TableIcon, ImageIcon, Film, Link2, Unlink,
  SmilePlus, AtSign, RemoveFormatting, Search, ArrowRightLeft,
  Type, ChevronDown, Maximize2, Minimize2, Palette, Highlighter,
  LetterText, Rows3, Columns3, TableProperties, Plus,
  Download, Upload, FileText, Music, ChevronRight, ToggleLeft,
  Columns2, Video, MessageSquare, MoreHorizontal, ImagePlus,
  GripVertical, Pencil, Lightbulb, Ruler, Keyboard,
  Paintbrush, Pipette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import './editor-styles.css';

// -------------------- Types --------------------

export type EditorMode = 'editing' | 'viewing';

export interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  /** Called whenever the editor selection changes. Passes the selected text (empty string when nothing is selected). */
  onSelectionChange?: (selectedText: string) => void;
}

export interface TiptapEditorRef {
  editor: Editor | null;
  getSelectedText: () => string;
  getSelectedHtml: () => string;
  /** Replace the current selection with HTML. If a saved range exists (from saveSelectionForReplace), uses that instead. */
  replaceSelection: (html: string) => void;
  /** Insert HTML right after the current (or saved) selection. */
  insertAfterSelection: (html: string) => void;
  hasSelection: () => boolean;
  /** Save the current selection range so it can be used after focus is lost (e.g., clicking an external button). Returns the saved text. */
  saveSelectionForReplace: () => string;
}

// -------------------- Color Palettes --------------------
const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#64748b' },
  { name: 'White', value: '#ffffff' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Red', value: '#fecaca' },
];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Merriweather', value: 'Merriweather, serif' },
  { label: 'Mono', value: 'ui-monospace, monospace' },
  { label: 'System UI', value: 'system-ui, sans-serif' },
];

const FONT_SIZES = ['10px', '11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px', '22px', '24px', '28px', '32px', '36px', '48px', '64px', '72px'];

const LINE_HEIGHTS = ['1', '1.15', '1.2', '1.3', '1.4', '1.5', '1.6', '1.75', '2', '2.5', '3'];

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Smileys & People': [
    '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🥳','🤠','🤡','🥴','😈','👿','👹','💀','☠️','👻','👽','🤖','💩','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊','👦','👧','👨','👩','👴','👵','👶','👼','🎅','🤶','🧑‍💼','🧑‍🎓','🧑‍🍳','🧑‍🔧','🧑‍⚕️','👨‍👩‍👧‍👦','👫','👬','👭','💑','💏','👪','🤝','👏','🙌','👐','🤲','🙏','💪','🦾','🦿','🖕','✌️','🤞','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👋','🤚','✋','🖖','👏','🤙','🦶','🦵','🦿','💪','🫶','🫡',
  ],
  'Animals & Nature': [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🐉','🐲','🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🎍','🪴','🎋','🍃','🍂','🍁','🪺','🪹','🍄',
  ],
  'Food & Drink': [
    '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🥜','🫘','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🫗',
  ],
  'Activity': [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','🤺','⛹️','🏊','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🕹️','🧩','🪄','🪅','🎱','🔮','🧿','🎮','🕹️','🎰','🎲','🧩','🪄','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🎻','🎭','🩰',
  ],
  'Travel & Places': [
    '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽','🦼','🛴','🚲','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧','🚦','🚥','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🛕','🕍','⛩️','🕋',
  ],
  'Objects': [
    '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','🩻','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷️','🪧','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁','📂','🗂️','🗞️','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓',
  ],
  'Symbols': [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','🟰','♾️','💲','💱','™️','©️','®️','👁️‍🗨️','🔚','🔙','🔛','🔝','🔜','〰️','➰','➿','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛','🕜','🕝','🕞','🕟','🕠','🕡','🕢','🕣','🕤','🕥','🕦','🕧','🏳️','🏴','🏴‍☠️','🏁','🚩','🏳️‍🌈','🏳️‍⚧️',
  ],
  'Flags': [
    '🏁','🚩','🏳️','🏴','🏴‍☠️','🏳️‍🌈','🏳️‍⚧️','🏳️',
    '🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇯🇵','🇰🇷','🇨🇳','🇷🇺',
    '🇧🇷','🇮🇳','🇨🇦','🇦🇺','🇲🇽','🇸🇦','🇦🇪','🇿🇦','🇳🇬','🇪🇬',
    '🇹🇷','🇦🇷','🇨🇴','🇨🇱','🇵🇪','🇨🇺','🇯🇲','🇵🇭','🇮🇩','🇲🇾',
    '🇳🇿','🇸🇬','🇹🇭','🇻🇳','🇧🇩','🇰🇪','🇬🇭','🇹🇳','🇲🇦','🇪🇹',
    '🇹🇿','🇺🇬','🇺🇾','🇵🇾','🇧🇴','🇵🇦','🇨🇷','🇭🇳','🇬🇹','🇸🇻',
    '🇳🇮','🇩🇴','🇪🇨','🇨🇭','🇦🇹','🇧🇪','🇧🇬','🇭🇷','🇨🇿','🇩🇰',
    '🇪🇪','🇫🇮','🇬🇷','🇭🇺','🇮🇸','🇮🇪','🇱🇻','🇱🇹','🇲🇹','🇳🇱',
    '🇳🇴','🇵🇱','🇵🇹','🇷🇴','🇷🇸','🇸🇰','🇸🇮','🇸🇪','🇺🇦','🇬🇪',
    '🇦🇲','🇦🇿','🇧🇾','🇰🇿','🇺🇿','🇹🇲','🇰🇬','🇲🇳','🇹🇯','🇹🇰',
    '🇦🇫','🇧🇯','🇧🇮','🇧🇼','🇨🇫','🇹🇩','🇨🇲','🇨🇬','🇨🇩','🇩🇯',
    '🇬🇶','🇪🇷','🇬🇦','🇬🇲','🇬🇳','🇬🇼','🇬🇾','🇨🇮','🇰🇪','🇱🇷',
    '🇲🇷','🇲🇼','🇳🇪','🇸🇳','🇸🇱','🇸🇴','🇿🇲','🇿🇼','🇦🇴','🇨🇻',
    '🇰🇲','🇲🇬','🇲🇺','🇾🇹','🇸🇨','🇸🇽','🇰🇳','🇱🇨','🇻🇨','🇩🇲',
    '🇬🇩','🇰🇵','🇲🇴','🇲🇰','🇵🇸','🇵🇼','🇸🇧','🇹🇻','🇻🇺','🇼🇫',
    '🇹🇴','🇳🇨','🇳🇺','🇳🇫','🇵🇳','🇬🇮','🇪🇭','🇮🇴','🇸🇯','🇧🇲',
    '🇰🇾','🇫🇰','🇲🇵','🇹🇨','🇻🇬','🇻🇮','🇧🇳','🇲🇭','🇵🇫','🇼🇸',
    '🇨🇰','🇳🇿','🇹🇰','🇬🇺','🇲🇸','🇧🇱','🇵🇲','🇸🇷','🇬🇾','🇬🇱',
    '🇦🇼','🇨🇼','🇸🇽','🇨🇺','🇪🇺',
  ],
};

const EMOJI_GRID = Object.values(EMOJI_CATEGORIES).flat();

// -------------------- Custom Nodes --------------------

// Toggle Block: renders as a styled collapsible div
const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [{ tag: 'div[data-toggle]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-toggle': 'true' }, 0];
  },
  addKeyboardShortcuts() {
    return { Enter: () => this.editor.commands.splitBlock() };
  },
});

// Column Layout: renders as a grid div
const ColumnLayout = Node.create({
  name: 'columnLayout',
  group: 'block',
  content: 'columnLayoutColumn columnLayoutColumn columnLayoutColumn',
  parseHTML() {
    return [{ tag: 'div[data-columns]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-columns': '3' }, 0];
  },
  addAttributes() {
    return { columns: { default: 3 } };
  },
});

const ColumnLayoutColumn = Node.create({
  name: 'columnLayoutColumn',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-column': '' }, 0];
  },
  isolating: true,
});

// -------------------- Toolbar Button --------------------

function Tb({
  children, tooltip, active = false, onClick, disabled = false, className,
}: {
  children: React.ReactNode; tooltip: string; active?: boolean;
  onClick: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => {
            // Prevent editor from losing focus/selection when clicking toolbar
            e.preventDefault();
          }}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-150 shrink-0',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            disabled && 'opacity-40 pointer-events-none',
            active
              ? 'bg-accent text-accent-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function TSep() {
  return <div className="h-5 w-px bg-border/60 mx-1 shrink-0" />;
}

function TDropdown({
  label, icon, active, children, className,
}: {
  label: string; icon: React.ReactNode; active?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                'inline-flex items-center gap-1 h-8 px-2 rounded-lg transition-all duration-150 shrink-0',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                active
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                className,
              )}
            >
              {icon}
              <span className="hidden lg:inline text-xs max-w-[60px] truncate">{label}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="text-xs">{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[160px]" onMouseDown={(e) => e.preventDefault()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// -------------------- Enhanced Color Picker ----------------

function ColorPicker({
  colors, label, icon, onPick, onClear, currentColor, type = 'text',
}: {
  colors: typeof TEXT_COLORS; label: string; icon: React.ReactNode;
  onPick: (val: string) => void; onClear?: () => void; currentColor?: string; type?: 'text' | 'bg';
}) {
  const [tab, setTab] = useState<'default' | 'custom'>('default');
  const [customColor, setCustomColor] = useState('#000000');
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-150 shrink-0',
                'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            >
              <span className="relative">
                {icon}
                {currentColor && currentColor !== '' && (
                  <span className="absolute -bottom-0.5 left-0.5 right-0.5 h-1 rounded-full" style={{ backgroundColor: currentColor }} />
                )}
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="text-xs">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-56 p-2.5" align="start">
        <p className="text-[10px] font-medium text-muted-foreground mb-2 px-1">{label}</p>
        {/* Tabs */}
        <div className="flex gap-1 mb-2">
          <button type="button" onClick={() => setTab('default')} className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors', tab === 'default' ? 'bg-accent text-accent-foreground border-transparent' : 'border-border/50 text-muted-foreground hover:bg-muted')}>Default Colors</button>
          <button type="button" onClick={() => setTab('custom')} className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors', tab === 'custom' ? 'bg-accent text-accent-foreground border-transparent' : 'border-border/50 text-muted-foreground hover:bg-muted')}>Custom Color</button>
        </div>
        {tab === 'default' ? (
          <div className="grid grid-cols-6 gap-1.5">
            {colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(c.value)}
                className={cn(
                  'h-6 w-6 rounded-md border border-border/60 transition-all hover:scale-110 hover:shadow-sm',
                  !c.value && 'border-dashed bg-muted/40',
                )}
                style={c.value ? { backgroundColor: c.value } : undefined}
                title={c.name}
              >
                {!c.value && <span className="text-[10px] text-muted-foreground">✕</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
              <Input value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="h-8 text-xs font-mono flex-1" placeholder="#000000" />
              <Button type="button" size="sm" className="h-8 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(customColor)}>Apply</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['#000000','#333333','#666666','#999999','#cccccc','#ffffff','#ff0000','#ff6600','#ffcc00','#33cc33','#3399ff','#9933ff','#ff33cc','#ff6666','#ffcc66','#66ff66','#66ccff','#cc66ff','#ff99cc','#993300','#336600','#003366','#330033','#660000'].map(c => (
                <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setCustomColor(c); onPick(c); }} className="h-5 w-5 rounded border border-border/60 hover:scale-110 transition-transform" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          </div>
        )}
        {/* Clear button */}
        {onClear && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClear} className="mt-2 w-full text-[10px] text-muted-foreground hover:text-foreground py-1 border-t border-border/50 text-center transition-colors">Clear</button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// -------------------- Main Component --------------------

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(function TiptapEditor({
  content: initialContent,
  onChange,
  editable: externalEditable = true,
  placeholder = '',
  className,
  onSelectionChange,
}, ref) {
  const [editorMode, setEditorMode] = useState<EditorMode>('editing');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findCount, setFindCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const findCountRef = useRef(0);

  // Comment state
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Media library state
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaItems, setMediaItems] = useState<Array<{ id: string; filename: string; url: string; thumbnailUrl?: string; alt?: string }>>([]);

  // Emoji search
  const [emojiSearch, setEmojiSearch] = useState('');
  const [emojiCategory, setEmojiCategory] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
  const [currentLineHeight, setCurrentLineHeight] = useState('');

  // Floating toolbar state (positioned above selected text)
  const [floatingToolbar, setFloatingToolbar] = useState<{ x: number; y: number; show: boolean }>({
    x: 0, y: 0, show: false,
  });

  // Table context menu state (right-click on table)
  const [tableCtxMenu, setTableCtxMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    activeSubmenu: string | null;
  }>({ show: false, x: 0, y: 0, activeSubmenu: null });
  const tableCtxMenuRef = useRef<HTMLDivElement>(null);

  const closeTableCtxMenu = useCallback(() => {
    setTableCtxMenu((prev) => ({ ...prev, show: false, activeSubmenu: null }));
  }, []);

  // handleTableContextMenu is defined after editor & isEditable declarations

  // Close context menu on click outside or scroll
  useEffect(() => {
    if (!tableCtxMenu.show) return;
    const handleClick = () => closeTableCtxMenu();
    const handleScroll = () => closeTableCtxMenu();
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTableCtxMenu(); };
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tableCtxMenu.show, closeTableCtxMenu]);
  // Keep onSelectionChange ref so the effect always sees the latest callback
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; });


  // Saved selection for use after focus is lost (e.g., clicking AI action buttons outside the editor)
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const isEditable = externalEditable && editorMode !== 'viewing';

  // Custom indent + line-height extension for paragraphs
  const IndentExt = useMemo(() => Extension.create({
    name: 'customIndent',
    addGlobalAttributes() {
      return [
        {
          types: ['paragraph', 'heading'],
          attributes: {
            indent: {
              default: 0,
              parseHTML: (element) => parseInt(element.getAttribute('data-indent') || '0', 10),
              renderHTML: (attributes) => {
                if (!attributes.indent) return {};
                return { 'data-indent': attributes.indent, style: `padding-left: ${attributes.indent}em;` };
              },
            },
            lineHeight: {
              default: null,
              parseHTML: (element) => element.getAttribute('data-line-height'),
              renderHTML: (attributes) => {
                if (!attributes.lineHeight) return {};
                return { 'data-line-height': attributes.lineHeight, style: `line-height: ${attributes.lineHeight};` };
              },
            },
          },
        },
      ];
    },
    addCommands() {
      return {
        indent: () => ({ tr, state, dispatch }) => {
          const { selection } = state;
          let changed = false;
          state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (node.isBlock && (node.type.name === 'paragraph' || node.type.name === 'heading')) {
              const current = (node.attrs.indent || 0) + 2;
              if (current <= 20) {
                tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: current });
                changed = true;
              }
            }
          });
          if (dispatch && changed) dispatch(tr);
          return changed;
        },
        outdent: () => ({ tr, state, dispatch }) => {
          const { selection } = state;
          let changed = false;
          state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (node.isBlock && (node.type.name === 'paragraph' || node.type.name === 'heading')) {
              const current = (node.attrs.indent || 0) - 2;
              if (current >= 0) {
                tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: Math.max(0, current) });
                changed = true;
              }
            }
          });
          if (dispatch && changed) dispatch(tr);
          return changed;
        },
      };
    },
  }), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,          // replaced by CodeBlockLowlight
        orderedList: false,        // replaced by StyledOrderedList
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      StyledOrderedList,
      // NOTE: TextStyleKit bundles color/fontSize/fontFamily/textStyle
      // Underline and Link are added separately (TextStyleKit does NOT include them)
      Underline,
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'editor-table' } }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Youtube.configure({ HTMLAttributes: { class: 'editor-video' } }),
      Subscript,
      Superscript,
      CodeBlockLowlight.configure({ lowlight }),
      IndentExt,
      ToggleBlock,
      ColumnLayout,
      ColumnLayoutColumn,
    ],
    content: initialContent || '',
    editable: isEditable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60vh] editor-content',
      },
      handlePaste: (view, event) => {
        // paste without formatting if holding shift
        if (event.shiftKey) {
          const text = event.clipboardData?.getData('text/plain') || '';
          view.dispatch(view.state.tr.insertText(text));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedHtmlRef.current = html;
      onChange(html);
    },
    onSelectionUpdate: ({ editor }) => {
      // onSelectionChange is handled via a separate useEffect below
      // (to keep useEditor options stable and avoid stale closure issues)
    },
    immediatelyRender: false,
  });

  // ---- Floating toolbar: listen to selection changes ----
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { from, to, empty } = editor.state.selection;

      if (empty) {
        setFloatingToolbar((ft) => (ft.show ? { ...ft, show: false } : ft));
        onSelectionChangeRef.current?.('');
        return;
      }

      // Notify parent of new selected text
      onSelectionChangeRef.current?.(editor.state.doc.textBetween(from, to, '\n'));

      // Use rAF so the DOM selection is fully committed before reading getBoundingClientRect
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect.width && !rect.height) return;

        const TOOLBAR_H = 40;
        const GAP = 8;
        const viewW = window.innerWidth;

        // Center the toolbar over the selection, clamped to viewport
        let x = rect.left + rect.width / 2;
        x = Math.max(120, Math.min(viewW - 120, x));

        // Place above the selection; if not enough room, place below
        let y = rect.top - TOOLBAR_H - GAP;
        if (y < 8) y = rect.bottom + GAP;

        setFloatingToolbar({ x, y, show: true });
      });
    };

    const handleBlur = () => {
      // Small delay so onMouseDown e.preventDefault() on toolbar buttons can fire first
      setTimeout(() => {
        setFloatingToolbar((ft) => ({ ...ft, show: false }));
        onSelectionChangeRef.current?.('');
      }, 120);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('blur', handleBlur);
    };
  }, [editor]);

  // ---- Sync editable state ----
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable);
    }
  }, [editor, isEditable]);

  // Expose editor instance and selection helpers to parent via ref
  useImperativeHandle(ref, () => ({
    editor,
    getSelectedText: () => {
      if (!editor) return '';
      const { from, to, empty } = editor.state.selection;
      if (empty) return '';
      return editor.state.doc.textBetween(from, to, '\n');
    },
    getSelectedHtml: () => {
      if (!editor) return '';
      const { from, to, empty } = editor.state.selection;
      if (empty) return '';
      // Use DOMParser to get the HTML of the selected slice
      const slice = editor.state.doc.slice(from, to);
      const tmp = document.createElement('div');
      const fragment = DOMSerializer.fromSchema(editor.state.schema).serializeFragment(slice.content);
      tmp.appendChild(fragment);
      return tmp.innerHTML;
    },
    saveSelectionForReplace: () => {
      if (!editor) return '';
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        savedSelectionRef.current = null;
        return '';
      }
      savedSelectionRef.current = { from, to };
      return editor.state.doc.textBetween(from, to, '\n');
    },
    replaceSelection: (html: string) => {
      if (!editor) return;
      const range = savedSelectionRef.current;
      if (!range) return;
      savedSelectionRef.current = null;
      editor.chain().focus().deleteRange({ from: range.from, to: range.to }).insertContent(html).run();
    },
    insertAfterSelection: (html: string) => {
      if (!editor) return;
      const range = savedSelectionRef.current;
      if (!range) return;
      savedSelectionRef.current = null;
      // Insert a new paragraph with the content right after the selection end
      editor.chain()
        .focus()
        .insertContentAt(range.to, `<p>${html}</p>`)
        .run();
    },

    hasSelection: () => {
      if (!editor) return false;
      const { empty } = editor.state.selection;
      return !empty;
    },
  }), [editor]);

  // ---- Table context menu handler (right-click on table cell) ----
  const handleTableContextMenu = useCallback((e: React.MouseEvent) => {
    if (!editor || !isEditable) return;
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th');
    if (!cell) return;
    e.preventDefault();
    setTableCtxMenu({ show: true, x: e.clientX, y: e.clientY, activeSubmenu: null });
  }, [editor, isEditable]);

  // Sync content from outside (e.g. loading saved article, AI generation).
  // We track the last HTML the editor emitted so we can skip setContent() when
  // the parent re-renders with the same value the editor just produced.
  // Calling setContent() replaces the entire document and wipes the undo stack,
  // so we must only do it for genuine external changes.
  const lastEmittedHtmlRef = useRef(initialContent);
  useEffect(() => {
    if (!editor) return;
    // Only update the editor if the incoming content is different from what
    // the editor itself last produced (i.e. a genuine external change).
    if (initialContent !== lastEmittedHtmlRef.current) {
      editor.commands.setContent(initialContent || '', false);
      // Keep ref in sync so we don't re-apply the same content on the next render
      lastEmittedHtmlRef.current = initialContent || '';
    }
  });

  // ---- Computed stats ----
  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0, readingTime: '< 1 min' };
    const chars = editor.storage.characterCount?.characters() ?? 0;
    const words = editor.storage.characterCount?.words() ?? 0;
    const mins = Math.ceil(words / 200);
    return { words, chars, readingTime: mins < 1 ? '< 1 min' : `${mins} min` };
  }, [editor, editor?.storage.characterCount?.characters()]);

  // ---- Format helpers ----
  const handleCopy = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n');
    navigator.clipboard.writeText(text);
  }, [editor]);

  const handlePaste = useCallback(async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      editor.commands.insertContent(text);
    } catch {
      // clipboard access denied
    }
  }, [editor]);

  const handlePastePlain = useCallback(async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      editor.commands.insertContent(text);
    } catch {
      // clipboard access denied
    }
  }, [editor]);

  // ---- Find/Replace ----
  const handleFind = useCallback(() => {
    setShowFindReplace((v) => !v);
    setFindText('');
    setReplaceText('');
    setFindCount(0);
  }, []);

  const handleFindNext = useCallback(() => {
    if (!editor || !findText) return;
    const { state } = editor;
    const { doc } = state;
    let count = 0;
    const lowerFind = findText.toLowerCase();
    let startFrom = state.selection.from;

    if (findCountRef.current === 0) startFrom = 0;
    else startFrom = state.selection.to;

    doc.descendants((node, pos) => {
      if (node.isText) {
        const text = node.text?.toLowerCase() || '';
        let idx = text.indexOf(lowerFind);
        while (idx !== -1) {
          const absPos = pos + idx;
          if (absPos > startFrom - findText.length) {
            if (count === 0) {
              editor.commands.setTextSelection({
                from: absPos,
                to: absPos + findText.length,
              });
            }
            count++;
          }
          idx = text.indexOf(lowerFind, idx + 1);
        }
      }
    });

    if (count === 0 && startFrom > 0) {
      // Wrap around
      findCountRef.current = 0;
      doc.descendants((node, pos) => {
        if (node.isText) {
          const text = node.text?.toLowerCase() || '';
          let idx = text.indexOf(lowerFind);
          while (idx !== -1) {
            const absPos = pos + idx;
            if (count === 0) {
              editor.commands.setTextSelection({ from: absPos, to: absPos + findText.length });
            }
            count++;
            idx = text.indexOf(lowerFind, idx + 1);
          }
        }
      });
    }

    findCountRef.current++;
    setFindCount(count);
  }, [editor, findText]);

  const handleReplace = useCallback(() => {
    if (!editor || !findText) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    if (selectedText.toLowerCase() === findText.toLowerCase()) {
      editor.chain().focus().insertContentAt({ from, to }, replaceText).run();
    }
    handleFindNext();
  }, [editor, findText, replaceText, handleFindNext]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    // Simple text replacement in HTML (works for plain text matches)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const replaceInTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const newText = node.textContent?.replace(regex, replaceText) || '';
        if (newText !== node.textContent) {
          node.textContent = newText;
        }
      } else {
        node.childNodes.forEach(replaceInTextNodes);
      }
    };
    replaceInTextNodes(tempDiv);
    editor.commands.setContent(tempDiv.innerHTML);
    setFindCount(0);
    findCountRef.current = 0;
  }, [editor, findText, replaceText]);

  // ---- URL validation helper ----
  const isValidUrl = useCallback((url: string): boolean => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, []);

  // ---- YouTube URL helper ----
  const getYoutubeEmbedUrl = useCallback((url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    return null;
  }, []);

  // ---- Link ----
  const handleSetLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl && !isValidUrl(linkUrl)) return;
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl, isValidUrl]);

  // ---- Image ----
  const handleSetImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setShowImageInput(false);
    setImageUrl('');
  }, [editor, imageUrl]);

  // ---- Emoji ----
  const handleInsertEmoji = useCallback((emoji: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(emoji).run();
    setShowEmojiPicker(false);
  }, [editor]);

  // ---- Table ----
  const handleInsertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const handleAddColumnBefore = useCallback(() => { editor?.chain().focus().addColumnBefore().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleAddColumnAfter = useCallback(() => { editor?.chain().focus().addColumnAfter().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleDeleteColumn = useCallback(() => { editor?.chain().focus().deleteColumn().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleAddRowBefore = useCallback(() => { editor?.chain().focus().addRowBefore().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleAddRowAfter = useCallback(() => { editor?.chain().focus().addRowAfter().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleDeleteRow = useCallback(() => { editor?.chain().focus().deleteRow().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleDeleteTable = useCallback(() => { editor?.chain().focus().deleteTable().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleMergeCells = useCallback(() => { editor?.chain().focus().mergeCells().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);
  const handleSplitCell = useCallback(() => { editor?.chain().focus().splitCell().run(); closeTableCtxMenu(); }, [editor, closeTableCtxMenu]);

  // ---- Export ----
  const handleExportHTML = useCallback(() => {
    if (!editor) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Article</title></head><body>${editor.getHTML()}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'article.html'; a.click();
  }, [editor]);

  const handleExportMarkdown = useCallback(() => {
    if (!editor) return;
    // Simple HTML→Markdown conversion
    const div = document.createElement('div');
    div.innerHTML = editor.getHTML();
    const toMd = (el: Element): string => {
      let md = '';
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) { md += node.textContent || ''; return; }
        const e = node as Element;
        const tag = e.tagName?.toLowerCase();
        const inner = toMd(e);
        if (tag === 'h1') md += `# ${inner}\n\n`;
        else if (tag === 'h2') md += `## ${inner}\n\n`;
        else if (tag === 'h3') md += `### ${inner}\n\n`;
        else if (tag === 'h4') md += `#### ${inner}\n\n`;
        else if (tag === 'h5') md += `##### ${inner}\n\n`;
        else if (tag === 'h6') md += `###### ${inner}\n\n`;
        else if (tag === 'p') md += `${inner}\n\n`;
        else if (tag === 'strong' || tag === 'b') md += `**${inner}**`;
        else if (tag === 'em' || tag === 'i') md += `*${inner}*`;
        else if (tag === 'u') md += `__${inner}__`;
        else if (tag === 's') md += `~~${inner}~~`;
        else if (tag === 'code') md += tag === 'pre' ? `\`\`\`\n${inner}\n\`\`\`` : `\`${inner}\``;
        else if (tag === 'pre') md += `\`\`\`\n${inner}\n\`\`\`\n\n`;
        else if (tag === 'blockquote') md += `> ${inner}\n\n`;
        else if (tag === 'ul') { e.querySelectorAll(':scope > li').forEach((li) => { md += `- ${li.textContent}\n`; }); md += '\n'; }
        else if (tag === 'ol') { let i = 1; e.querySelectorAll(':scope > li').forEach((li) => { md += `${i++}. ${li.textContent}\n`; }); md += '\n'; }
        else if (tag === 'a') md += `[${inner}](${e.getAttribute('href') || ''})`;
        else if (tag === 'img') md += `![${e.getAttribute('alt') || ''}](${e.getAttribute('src') || ''})`;
        else if (tag === 'hr') md += `---\n\n`;
        else md += inner;
      });
      return md;
    };
    const md = toMd(div);
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'article.md'; a.click();
  }, [editor]);

  const handleExportPDF = useCallback(() => {
    if (!editor) return;
    const content = editor.getHTML();
    const win = window.open('', '_blank')!;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Article</title><style>
      body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;color:#111;}
      h1,h2,h3,h4,h5,h6{margin-top:1.5em;margin-bottom:0.5em;}
      pre{background:#f5f5f5;padding:1em;border-radius:4px;overflow-x:auto;}
      code{background:#f5f5f5;padding:0.2em 0.4em;border-radius:3px;font-size:0.9em;}
      blockquote{border-left:4px solid #ccc;margin:0;padding-left:1em;color:#666;}
      table{border-collapse:collapse;width:100%;} td,th{border:1px solid #ccc;padding:8px;}
      img{max-width:100%;}
      @media print{body{margin:0;}}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  }, [editor]);

  const handleExportWord = useCallback(() => {
    if (!editor) return;
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='UTF-8'><title>Article</title></head><body>${editor.getHTML()}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'article.doc'; a.click();
  }, [editor]);

  const handleExportImage = useCallback(async () => {
    if (!editor) return;
    const editorEl = document.querySelector('.editor-content') as HTMLElement;
    if (!editorEl) return;
    try {
      const canvas = await html2canvas(editorEl, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'article.png';
      a.click();
    } catch (err) {
      console.error('Export image failed:', err);
    }
  }, [editor]);

  // ---- Import ----
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx') {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const buffer = ev.target?.result as ArrayBuffer;
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          editor.commands.setContent(result.value);
        } catch (err) {
          console.error('Word import failed:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (ext === 'html' || ext === 'htm') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'text/html');
          editor.commands.setContent(doc.body.innerHTML || content);
        } else if (ext === 'md' || ext === 'markdown') {
          const html = content
            .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
            .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
            .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[h|l|b|p])(.+)$/gm, '<p>$1</p>');
          editor.commands.setContent(html);
        } else {
          editor.commands.setContent(`<p>${content.replace(/\n/g, '</p><p>')}</p>`);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
    setShowImportDialog(false);
  }, [editor]);

  // ---- Audio ----
  const handleInsertAudio = useCallback((src: string) => {
    if (!editor || !src) return;
    editor.chain().focus().insertContent(`<p><audio controls src="${src}" style="width:100%;max-width:500px;"></audio></p>`).run();
    setShowAudioDialog(false);
    setAudioUrl('');
  }, [editor]);

  const handleAudioFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const url = URL.createObjectURL(file);
    handleInsertAudio(url);
    e.target.value = '';
  }, [editor, handleInsertAudio]);

  // ---- Video ----
  const handleInsertVideo = useCallback((src: string) => {
    if (!editor || !src) return;
    const isYoutube = src.includes('youtube') || src.includes('youtu.be');
    if (isYoutube) {
      editor.commands.setYoutubeVideo({ src });
    } else {
      editor.chain().focus().insertContent(`<p><video controls src="${src}" style="max-width:100%;border-radius:8px;"></video></p>`).run();
    }
    setShowVideoDialog(false);
    setVideoUrl('');
  }, [editor]);

  const handleVideoFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const url = URL.createObjectURL(file);
    handleInsertVideo(url);
    e.target.value = '';
  }, [editor, handleInsertVideo]);

  // ---- Toggle Block ----
  const handleInsertToggle = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'toggleBlock',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Toggle title — click to expand' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Hidden content here...' }] },
      ],
    }).run();
  }, [editor]);

  // ---- 3 Columns ----
  const handleInsert3Columns = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'columnLayout',
      content: [
        { type: 'columnLayoutColumn', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 1' }] }] },
        { type: 'columnLayoutColumn', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 2' }] }] },
        { type: 'columnLayoutColumn', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 3' }] }] },
      ],
    }).run();
  }, [editor]);

  // ---- Comment on selected text ----
  const handleSubmitComment = useCallback(() => {
    if (!editor || !commentText.trim()) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) { setShowCommentInput(false); setCommentText(''); return; }
    const commentId = 'c_' + Date.now();
    const escaped = commentText.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Wrap selected text with a comment span
    const text = editor.state.doc.textBetween(from, to, '\n');
    editor.chain().focus()
      .insertContentAt(
        { from, to },
        `<span class="editor-comment" data-comment-id="${commentId}" data-comment="${escaped}">${text}</span>`
      )
      .run();
    setShowCommentInput(false);
    setCommentText('');
  }, [editor, commentText]);

  // ---- Media Library ----
  const fetchMediaItems = useCallback(async (search = '') => {
    try {
      const params = new URLSearchParams({ limit: '20', type: 'image' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/media?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMediaItems(data.data || data.media || data || []);
      }
    } catch {
      // media fetch failed
    }
  }, []);

  const handleOpenMediaLibrary = useCallback(() => {
    setShowMediaLibrary(true);
    fetchMediaItems();
  }, [fetchMediaItems]);

  const handleMediaSearchChange = useCallback((val: string) => {
    setMediaSearch(val);
    fetchMediaItems(val);
  }, [fetchMediaItems]);

  const handleSelectMediaImage = useCallback((url: string) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: url }).run();
    setShowMediaLibrary(false);
    setMediaSearch('');
  }, [editor]);

  // ---- Image file upload ----
  const handleImageFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const url = URL.createObjectURL(file);
    editor.chain().focus().setImage({ src: url }).run();
    e.target.value = '';
  }, [editor]);

  // ---- Special Characters ----
  const SPECIAL_CHARS = [
    { label: 'Copyright', value: '\u00A9' }, { label: 'Registered', value: '\u00AE' }, { label: 'Trademark', value: '\u2122' },
    { label: 'Degree', value: '\u00B0' }, { label: 'Plus/Minus', value: '\u00B1' }, { label: 'Multiply', value: '\u00D7' },
    { label: 'Divide', value: '\u00F7' }, { label: 'Euro', value: '\u20AC' }, { label: 'Pound', value: '\u00A3' },
    { label: 'Yen', value: '\u00A5' }, { label: 'Section', value: '\u00A7' }, { label: 'Paragraph', value: '\u00B6' },
    { label: 'Bullet', value: '\u2022' }, { label: 'Ellipsis', value: '\u2026' }, { label: 'Em Dash', value: '\u2014' },
    { label: 'En Dash', value: '\u2013' }, { label: 'Left Quote', value: '\u201C' }, { label: 'Right Quote', value: '\u201D' },
    { label: 'Apostrophe', value: '\u2019' }, { label: 'Dagger', value: '\u2020' }, { label: 'Double Dagger', value: '\u2021' },
    { label: 'Left Arrow', value: '\u2190' }, { label: 'Right Arrow', value: '\u2192' },
    { label: 'Up Arrow', value: '\u2191' }, { label: 'Down Arrow', value: '\u2193' },
    { label: 'Not Equal', value: '\u2260' }, { label: 'Less/Equal', value: '\u2264' }, { label: 'Greater/Equal', value: '\u2265' },
    { label: 'Infinity', value: '\u221E' }, { label: 'Approx', value: '\u2248' }, { label: 'Square Root', value: '\u221A' },
    { label: 'Sum', value: '\u2211' }, { label: 'Pi', value: '\u03C0' }, { label: 'Omega', value: '\u03A9' },
    { label: 'Micro', value: '\u00B5' }, { label: 'Delta', value: '\u2206' }, { label: 'Check', value: '\u2713' },
    { label: 'Cross', value: '\u2717' },
  ];

  const handleInsertSpecialChar = useCallback((char: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(char).run();
  }, [editor]);

  // ---- Current color tracking ----
  const currentTextColor = editor?.getAttributes('textStyle').color || '';
  const currentHighlight = editor?.getAttributes('highlight').color || '';
  const currentFontFamily = editor?.getAttributes('textStyle').fontFamily || '';
  const currentFontSize = editor?.getAttributes('textStyle').fontSize || '';
  const currentHeading = editor?.isActive('heading', { level: 1 }) ? 'H1'
    : editor?.isActive('heading', { level: 2 }) ? 'H2'
    : editor?.isActive('heading', { level: 3 }) ? 'H3'
    : editor?.isActive('heading', { level: 4 }) ? 'H4'
    : editor?.isActive('heading', { level: 5 }) ? 'H5'
    : editor?.isActive('heading', { level: 6 }) ? 'H6'
    : 'Paragraph';
  const currentAlign = editor?.isActive({ textAlign: 'center' }) ? 'center'
    : editor?.isActive({ textAlign: 'right' }) ? 'right'
    : editor?.isActive({ textAlign: 'justify' }) ? 'justify'
    : 'left';

  const getOrderedListStyle = (): OrderedListStyle | null => {
    if (!editor?.isActive('orderedList')) return null;
    const attrs = editor.getAttributes('orderedList');
    const style = attrs?.style as string | undefined;
    if (!style) return 'decimal';
    const match = style.match(/list-style-type\s*:\s*([^;]+)/);
    return (match?.[1]?.trim() as OrderedListStyle) || 'decimal';
  };

  if (!editor) return null;

  return (
    <div className={cn(
      'flex flex-col h-full border border-border/50 rounded-xl overflow-hidden bg-background',
      isFullscreen && 'fixed inset-4 z-50 rounded-xl shadow-2xl',
      className,
    )}>
      {/* ========== TOOLBAR ROW 1 ========== */}
      <div className="shrink-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
        {/* Editor Mode */}
        <TDropdown
          label={editorMode === 'editing' ? 'Editing' : 'Viewing'}
          icon={editorMode === 'editing' ? <LetterText className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          active={editorMode !== 'editing'}
        >
          <DropdownMenuRadioGroup value={editorMode} onValueChange={(v) => setEditorMode(v as EditorMode)}>
            <DropdownMenuRadioItem value="editing"><Pencil className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />Editing</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="viewing"><EyeIcon className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />Viewing</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </TDropdown>

        {editorMode === 'viewing' ? (
          <>
            <TSep />
            {/* Highlight */}
            <ColorPicker
              colors={HIGHLIGHT_COLORS}
              label="Highlight"
              icon={<Highlighter className="h-4 w-4" />}
              currentColor={currentHighlight}
              onPick={(val) => val ? editor.chain().focus().toggleHighlight({ color: val }).run() : editor.chain().focus().unsetHighlight().run()}
            />
            {/* Comment */}
            <Tb tooltip="Add Comment" onClick={() => { saveSelectionForReplace(); setShowCommentInput(true); setCommentText(''); }}>
              <MessageSquare className="h-4 w-4" />
            </Tb>
          </>
        ) : (
          <>
        <TSep />

        {/* Import / Export */}
        <input ref={importFileRef} type="file" accept=".html,.htm,.md,.markdown,.txt,.docx" className="hidden" onChange={handleImportFile} />
        <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFileUpload} />
        <input ref={videoFileRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFileUpload} />
        <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileUpload} />
        <TDropdown label="Import" icon={<Upload className="h-4 w-4" />}>
          <DropdownMenuItem className="text-xs" onClick={() => importFileRef.current?.click()}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />From HTML / Markdown / Text
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => importFileRef.current?.click()}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />From Word (.docx)
          </DropdownMenuItem>
        </TDropdown>
        <TDropdown label="Export" icon={<Download className="h-4 w-4" />}>
          <DropdownMenuItem className="text-xs" onClick={handleExportHTML}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />Export as HTML
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={handleExportMarkdown}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />Export as Markdown
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={handleExportPDF}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={handleExportImage}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />Export as Image
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={handleExportWord}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />Export as Word (.doc)
          </DropdownMenuItem>
        </TDropdown>

        <TSep />

        {/* History */}
        <Tb tooltip="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo2 className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo2 className="h-4 w-4" />
        </Tb>

        <TSep />

        {/* Clipboard */}
        <Tb tooltip="Copy" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Paste" onClick={handlePaste}>
          <Clipboard className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Paste without formatting (Shift+Paste)" onClick={handlePastePlain}>
          <ClipboardPaste className="h-4 w-4" />
        </Tb>

        <TSep />

        {/* Font Family */}
        <TDropdown
          label={FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.label || 'Font'}
          icon={<Type className="h-4 w-4" />}
          active={!!currentFontFamily}
        >
          {FONT_FAMILIES.map((f) => (
            <DropdownMenuItem
              key={f.label}
              onClick={() => f.value ? editor.chain().focus().setFontFamily(f.value).run() : editor.chain().focus().unsetFontFamily().run()}
              className={cn('text-xs', currentFontFamily === f.value && 'bg-accent')}
            >
              <span style={{ fontFamily: f.value || 'inherit' }}>{f.label}</span>
            </DropdownMenuItem>
          ))}
        </TDropdown>

        {/* Font Size */}
        <TDropdown
          label={currentFontSize || 'Size'}
          icon={<span className="text-xs font-bold w-4 text-center">A</span>}
          active={!!currentFontSize}
        >
          {FONT_SIZES.map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => editor.chain().focus().setFontSize(s).run()}
              className={cn('text-xs', currentFontSize === s && 'bg-accent')}
            >
              <span style={{ fontSize: Math.min(parseInt(s), 20) }}>{s}</span>
            </DropdownMenuItem>
          ))}
        </TDropdown>

        {/* Line Height */}
        <TDropdown
          label={currentLineHeight || 'Line'}
          icon={<Ruler className="h-4 w-4" />}
          active={!!currentLineHeight}
        >
          {LINE_HEIGHTS.map((lh) => (
            <DropdownMenuItem
              key={lh}
              onClick={() => {
                if (!editor) return;
                const { from, to } = editor.state.selection;
                const { tr } = editor.state;
                let changed = false;
                editor.state.doc.nodesBetween(Math.min(from, to), Math.max(from, to), (node, pos) => {
                  if (node.isBlock && (node.type.name === 'paragraph' || node.type.name === 'heading')) {
                    tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: lh });
                    changed = true;
                  }
                });
                if (changed) editor.view.dispatch(tr);
              }}
              className={cn('text-xs', currentLineHeight === lh && 'bg-accent')}
            >
              <span style={{ lineHeight: lh, display: 'block' }}>{lh === '1' ? 'Single' : lh === '1.5' ? '1.5x' : lh === '2' ? 'Double' : lh}</span>
            </DropdownMenuItem>
          ))}
        </TDropdown>

        <TSep />

        {/* Block / Heading Type */}
        <TDropdown
          label={currentHeading}
          icon={
            currentHeading === 'H1' ? <Heading1 className="h-4 w-4" />
            : currentHeading === 'H2' ? <Heading2 className="h-4 w-4" />
            : currentHeading === 'H3' ? <Heading3 className="h-4 w-4" />
            : currentHeading === 'H4' ? <Heading4 className="h-4 w-4" />
            : currentHeading === 'H5' ? <Heading5 className="h-4 w-4" />
            : currentHeading === 'H6' ? <Heading6 className="h-4 w-4" />
            : <Pilcrow className="h-4 w-4" />
          }
          active={currentHeading !== 'Paragraph'}
        >
          <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className={cn('text-xs', currentHeading === 'Paragraph' && 'bg-accent')}>
            <Pilcrow className="h-4 w-4 mr-1.5" />Text (Paragraph)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cn('text-xs font-bold', currentHeading === 'H1' && 'bg-accent')}>Heading 1</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn('text-sm font-bold', currentHeading === 'H2' && 'bg-accent')}>Heading 2</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn('text-[13px] font-semibold', currentHeading === 'H3' && 'bg-accent')}>Heading 3</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className={cn('text-xs font-semibold', currentHeading === 'H4' && 'bg-accent')}>Heading 4</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} className={cn('text-xs font-medium', currentHeading === 'H5' && 'bg-accent')}>Heading 5</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()} className={cn('text-[11px] font-medium', currentHeading === 'H6' && 'bg-accent')}>Heading 6</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleInsertToggle} className="text-xs">
            <ChevronRight className="h-4 w-4 mr-1.5" />Toggle Block
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cn('text-xs', editor.isActive('blockquote') && 'bg-accent')}>
            <Quote className="h-4 w-4 mr-1.5" />Block Quote
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleInsert3Columns} className="text-xs">
            <Columns2 className="h-4 w-4 mr-1.5" />3 Columns
          </DropdownMenuItem>
        </TDropdown>

        <TSep />

        {/* Text Formatting */}
        <Tb tooltip="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Inline Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          <CodeXml className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>
          <span className="text-xs font-bold">X₂</span>
        </Tb>
        <Tb tooltip="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
          <span className="text-xs font-bold">X²</span>
        </Tb>

        <TSep />

        {/* Colors */}
        <ColorPicker
          colors={TEXT_COLORS}
          label="Text Color"
          icon={<Palette className="h-4 w-4" />}
          currentColor={currentTextColor}
          onPick={(val) => val ? editor.chain().focus().setColor(val).run() : editor.chain().focus().unsetColor().run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />
        <ColorPicker
          colors={HIGHLIGHT_COLORS}
          label="Background Color"
          icon={<Paintbrush className="h-4 w-4" />}
          currentColor={currentHighlight}
          onPick={(val) => val ? editor.chain().focus().toggleHighlight({ color: val }).run() : editor.chain().focus().unsetHighlight().run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
        />

        <TSep />

        {/* Keyboard Input */}
        <Tb tooltip="Keyboard Input" onClick={() => editor.chain().focus().insertContent('<span class="editor-kbd">Ctrl</span>').run()}>
          <Keyboard className="h-4 w-4" />
        </Tb>

        <TSep />

        {/* Alignment */}
        <TDropdown label="Align" icon={<AlignLeft className="h-4 w-4" />} active={currentAlign !== 'left'}>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeft className="h-3.5 w-3.5 mr-1.5" />Align Left
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenter className="h-3.5 w-3.5 mr-1.5" />Align Center
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRight className="h-3.5 w-3.5 mr-1.5" />Align Right
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
            <AlignJustify className="h-3.5 w-3.5 mr-1.5" />Justify
          </DropdownMenuItem>
        </TDropdown>

        <TSep />

        {/* Lists */}
        <Tb tooltip="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Tb>
        <TDropdown
          label="Numbered List"
          icon={<ListOrdered className="h-4 w-4" />}
          active={editor.isActive('orderedList')}
        >
          {ORDERED_LIST_STYLES.map((s) => (
            <DropdownMenuItem
              key={s.value}
              className="text-xs gap-2"
              onClick={() => {
                const cur = getOrderedListStyle();
                if (cur === s.value && editor.isActive('orderedList')) {
                  editor.chain().focus().toggleOrderedList().run();
                } else {
                  editor.chain().focus().toggleOrderedList().run();
                  (editor.chain().focus() as any).setOrderedListStyle(s.value).run();
                }
              }}
            >
              <span className="font-mono text-[11px] text-muted-foreground w-16 shrink-0">{s.preview}</span>
              <span>{s.label}</span>
              {getOrderedListStyle() === s.value && editor.isActive('orderedList') && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </TDropdown>
        <Tb tooltip="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <ListChecks className="h-4 w-4" />
        </Tb>

        <TSep />

        {/* Indent */}
        <Tb tooltip="Increase Indent" onClick={() => editor.chain().focus().indent().run()}>
          <Indent className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Decrease Indent" onClick={() => editor.chain().focus().outdent().run()}>
          <Outdent className="h-4 w-4" />
        </Tb>

        <TSep />

        {/* Insert Elements */}
        <Tb tooltip="Insert Link" active={editor.isActive('link')} onClick={() => {
          const prev = editor.getAttributes('link').href;
          setLinkUrl(prev || '');
          setShowLinkInput(true);
        }}>
          <Link2 className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Insert Image" onClick={() => { setImageUrl(''); setShowImageInput(true); }}>
          <ImageIcon className="h-4 w-4" />
        </Tb>
        {/* Video */}
        <Tb tooltip="Insert Video" onClick={() => { setVideoUrl(''); setShowVideoDialog(true); }}>
          <Film className="h-4 w-4" />
        </Tb>
        {/* Audio */}
        <Tb tooltip="Insert Audio" onClick={() => { setAudioUrl(''); setShowAudioDialog(true); }}>
          <Music className="h-4 w-4" />
        </Tb>
        {/* Comment */}
        <Tb tooltip="Add Comment" onClick={() => { saveSelectionForReplace(); setShowCommentInput(true); setCommentText(''); }}>
          <MessageSquare className="h-4 w-4" />
        </Tb>
        <TDropdown label="Table" icon={<TableIcon className="h-4 w-4" />}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs"><TableIcon className="h-3.5 w-3.5 mr-1.5" />Table</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleInsertTable} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />Insert Table
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs"><TableProperties className="h-3.5 w-3.5 mr-1.5" />Cell</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleMergeCells} className="text-xs"><TableProperties className="h-3.5 w-3.5 mr-1.5" />Merge Cells</DropdownMenuItem>
              <DropdownMenuItem onClick={handleSplitCell} className="text-xs">Split Cell</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs"><Rows3 className="h-3.5 w-3.5 mr-1.5" />Row</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleAddRowBefore} className="text-xs"><Rows3 className="h-3.5 w-3.5 mr-1.5" />Insert Row Before</DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddRowAfter} className="text-xs"><Rows3 className="h-3.5 w-3.5 mr-1.5" />Insert Row After</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteRow} className="text-xs">Delete Row</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs"><Columns3 className="h-3.5 w-3.5 mr-1.5" />Column</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleAddColumnBefore} className="text-xs"><Columns3 className="h-3.5 w-3.5 mr-1.5" />Insert Column Before</DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddColumnAfter} className="text-xs"><Columns3 className="h-3.5 w-3.5 mr-1.5" />Insert Column After</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteColumn} className="text-xs">Delete Column</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDeleteTable} className="text-xs text-destructive">Delete table</DropdownMenuItem>
        </TDropdown>
        <Tb tooltip="Horizontal Rule" onClick={() => { try { editor.chain().focus().setHorizontalRule().run(); } catch { editor.chain().focus().insertContent('<hr>').run(); } }}>
          <Minus className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Code Block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code className="h-4 w-4" />
        </Tb>

        {/* Emoji with search */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-150 shrink-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                  onClick={() => { setShowEmojiPicker(true); setEmojiSearch(''); setEmojiCategory(Object.keys(EMOJI_CATEGORIES)[0]); }}
                >
                  <SmilePlus className="h-4 w-4" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4} className="text-xs">Emoji</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80 p-2" align="start">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Search emojis..."
                className="h-7 pl-7 text-xs"
                autoFocus
              />
            </div>
            {/* Category tabs — no horizontal scroll */}
            {!emojiSearch && (
              <div className="flex flex-wrap gap-0.5 mb-2">
                {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setEmojiCategory(cat); setEmojiSearch(''); }}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 transition-colors',
                      (emojiCategory === cat && !emojiSearch) ? 'bg-accent text-accent-foreground border-transparent' : 'border-border/50 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-10 gap-0.5 max-h-48 overflow-y-auto">
              {(emojiSearch
                ? EMOJI_GRID.filter((e) => e.includes(emojiSearch))
                : (EMOJI_CATEGORIES[emojiCategory] || EMOJI_CATEGORIES[Object.keys(EMOJI_CATEGORIES)[0]] || [])
              ).map((emoji, i) => (
                <button
                  key={emoji + i}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertEmoji(emoji)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-base transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Mention */}
        <Tb tooltip="Mention (@)" onClick={() => editor.chain().focus().insertContent('@').run()}>
          <AtSign className="h-4 w-4" />
        </Tb>

        <TSep />

        {/* Find/Replace & Clear */}
        <Tb tooltip="Find & Replace (Ctrl+F)" active={showFindReplace} onClick={handleFind}>
          <Search className="h-4 w-4" />
        </Tb>
        <Tb tooltip="Clear Formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <RemoveFormatting className="h-4 w-4" />
        </Tb>

        {/* More Options (...) */}
        <TDropdown label="" icon={<MoreHorizontal className="h-4 w-4" />}>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().toggleSuperscript().run()}>
            <span className="font-bold mr-1.5">X²</span>Superscript
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().toggleSubscript().run()}>
            <span className="font-bold mr-1.5">X₂</span>Subscript
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-3.5 w-3.5 mr-1.5" />Bold
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-3.5 w-3.5 mr-1.5" />Italic
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-3.5 w-3.5 mr-1.5" />Underline
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-3.5 w-3.5 mr-1.5" />Strikethrough
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeft className="h-3.5 w-3.5 mr-1.5" />Align Left
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenter className="h-3.5 w-3.5 mr-1.5" />Align Center
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRight className="h-3.5 w-3.5 mr-1.5" />Align Right
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
            <AlignJustify className="h-3.5 w-3.5 mr-1.5" />Justify
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Popover>
            <PopoverTrigger asChild>
              <DropdownMenuItem className="text-xs" onSelect={(e) => e.preventDefault()}>
                <Type className="h-3.5 w-3.5 mr-1.5" />Special Characters...
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1">Insert Special Character</p>
              <div className="grid grid-cols-8 gap-1">
                {SPECIAL_CHARS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleInsertSpecialChar(c.value)}
                    className="h-7 w-7 flex items-center justify-center rounded border border-border/50 hover:bg-accent text-sm transition-colors"
                    title={c.label}
                  >
                    {c.value}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </TDropdown>
          </>
        )}

        {/* Fullscreen */}
        <div className="ml-auto">
          <Tb tooltip={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'} onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Tb>
        </div>
      </div>

      {/* ========== LINK INPUT BAR ========== */}
      {showLinkInput && (
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSetLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
            autoFocus
          />
          {linkUrl && !isValidUrl(linkUrl) && <span className="text-[10px] text-destructive shrink-0">Invalid URL</span>}
          <Button type="button" size="sm" className="h-8" onClick={handleSetLink} disabled={!!linkUrl && !isValidUrl(linkUrl)}>Apply</Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowLinkInput(false)}>
            <span className="text-xs">✕</span>
          </Button>
        </div>
      )}

      {/* ========== VIDEO DIALOG ========== */}
      {showVideoDialog && (
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
          <Film className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Paste video URL or upload a file..." className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleInsertVideo(videoUrl); if (e.key === 'Escape') setShowVideoDialog(false); }} autoFocus />
          <Button type="button" size="sm" className="h-8" onClick={() => handleInsertVideo(videoUrl)} disabled={!videoUrl.trim() || !isValidUrl(videoUrl)}>Insert</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => videoFileRef.current?.click()}>
            <Upload className="h-3 w-3" />Upload
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowVideoDialog(false)}><span className="text-xs">✕</span></Button>
        </div>
      )}

      {/* ========== AUDIO DIALOG ========== */}
      {showAudioDialog && (
        <div className="flex flex-col gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="Paste audio URL or upload a file..." className="h-8 text-sm flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsertAudio(audioUrl); if (e.key === 'Escape') setShowAudioDialog(false); }} autoFocus />
            <Button type="button" size="sm" className="h-8" onClick={() => handleInsertAudio(audioUrl)}>Insert</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => audioFileRef.current?.click()}>
              <Upload className="h-3 w-3" />Upload
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAudioDialog(false)}><span className="text-xs">✕</span></Button>
          </div>
        </div>
      )}

      {/* ========== IMAGE INPUT BAR ========== */}
      {showImageInput && (
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Paste image URL..."
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSetImage(); if (e.key === 'Escape') setShowImageInput(false); }}
            autoFocus
          />
          <Button type="button" size="sm" className="h-8" onClick={handleSetImage}>Insert</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => imageFileRef.current?.click()}>
            <Upload className="h-3 w-3" />Upload
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowImageInput(false)}>
            <span className="text-xs">✕</span>
          </Button>
        </div>
      )}

      {/* ========== COMMENT INPUT BAR ========== */}
      {showCommentInput && (
        <div className="flex items-center gap-2 border-b border-border/50 bg-amber-500/5 px-3 py-2">
          <MessageSquare className="h-4 w-4 text-amber-600 shrink-0" />
          <Input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment on selected text..."
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); if (e.key === 'Escape') { setShowCommentInput(false); setCommentText(''); } }}
            autoFocus
          />
          <Button type="button" size="sm" className="h-8" onClick={handleSubmitComment} disabled={!commentText.trim()}>Comment</Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowCommentInput(false); setCommentText(''); }}>
            <span className="text-xs">✕</span>
          </Button>
        </div>
      )}

      {/* ========== MEDIA LIBRARY DIALOG ========== */}
      {showMediaLibrary && (
        <div className="flex flex-col gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input value={mediaSearch} onChange={(e) => handleMediaSearchChange(e.target.value)} placeholder="Search media..." className="h-8 pl-7 text-sm" autoFocus />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => imageFileRef.current?.click()}>
              <Upload className="h-3 w-3" />Upload
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowMediaLibrary(false); setMediaSearch(''); }}>
              <span className="text-xs">✕</span>
            </Button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {mediaItems.length === 0 && <p className="text-xs text-muted-foreground col-span-full text-center py-4">No media found. Upload or search for images.</p>}
            {mediaItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectMediaImage(item.url)}
                className="aspect-square rounded-lg border border-border/50 overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                title={item.filename}
              >
                <img src={item.thumbnailUrl || item.url} alt={item.alt || item.filename} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========== FIND/REPLACE BAR ========== */}
      {showFindReplace && (
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2 flex-wrap">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={findText}
              onChange={(e) => { setFindText(e.target.value); findCountRef.current = 0; setFindCount(0); }}
              placeholder="Find..."
              className="h-8 pl-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleFindNext(); if (e.key === 'Escape') setShowFindReplace(false); }}
              autoFocus
            />
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <ArrowRightLeft className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace..."
              className="h-8 pl-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleReplace(); if (e.key === 'Escape') setShowFindReplace(false); }}
            />
          </div>
          {findCount > 0 && <span className="text-[11px] text-muted-foreground">{findCount} found</span>}
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleFindNext}>Next</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleReplace}>Replace</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleReplaceAll}>All</Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowFindReplace(false); findCountRef.current = 0; }}>
            <span className="text-xs">✕</span>
          </Button>
        </div>
      )}

      {/* ========== FLOATING CONTEXTUAL TOOLBAR (position:fixed, above selection) ========== */}
      {floatingToolbar.show && editor && (
        <div
          data-floating-toolbar=""
          style={{
            position: 'fixed',
            left: floatingToolbar.x,
            top: floatingToolbar.y,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 backdrop-blur-sm shadow-lg px-1.5 py-1 pointer-events-auto"
        >
          {/* Bold */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors', editor.isActive('bold') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            <Bold className="h-3.5 w-3.5" />
          </button>
          {/* Italic */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors', editor.isActive('italic') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            <Italic className="h-3.5 w-3.5" />
          </button>
          {/* Underline */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors', editor.isActive('underline') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>
          {/* Strikethrough */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors', editor.isActive('strike') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          {/* Code */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors', editor.isActive('code') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            <Code className="h-3.5 w-3.5" />
          </button>
          {/* Superscript */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors text-[10px] font-bold', editor.isActive('superscript') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            X²
          </button>
          {/* Subscript */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors text-[10px] font-bold', editor.isActive('subscript') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            X₂
          </button>
          <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
          {/* Highlight */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} title="Highlight"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors', editor.isActive('highlight') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            <Highlighter className="h-3.5 w-3.5" />
          </button>
          {/* Link */}
          <button type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const url = window.prompt('Enter URL:');
              if (url) { editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); }
              else if (url === '') { editor.chain().focus().unsetLink().run(); }
            }}
            title="Link"
            className={cn('h-7 w-7 flex items-center justify-center rounded transition-colors', editor.isActive('link') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}>
            <Link2 className="h-3.5 w-3.5" />
          </button>
          {/* Clear Formatting */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Clear Formatting"
            className="h-7 w-7 flex items-center justify-center rounded transition-colors text-muted-foreground hover:bg-accent/70 hover:text-foreground">
            <RemoveFormatting className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ========== TABLE CONTEXT MENU (right-click on table) ========== */}
      {tableCtxMenu.show && (
        <div
          ref={tableCtxMenuRef}
          className="table-ctx-menu"
          style={{ position: 'fixed', left: tableCtxMenu.x, top: tableCtxMenu.y, zIndex: 9999 }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseLeave={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: null }))}
        >
          {/* Table submenu trigger */}
          <div
            className="table-ctx-item"
            onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'table' }))}
          >
            <span>Table</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            {tableCtxMenu.activeSubmenu === 'table' && (
              <div className="table-ctx-submenu" onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'table' }))}>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleInsertTable(); closeTableCtxMenu(); }}>
                  <Plus className="h-3.5 w-3.5 mr-2 opacity-70" />Insert Table
                </div>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleDeleteTable(); }}>
                  Delete Table
                </div>
              </div>
            )}
          </div>

          {/* Cell submenu trigger */}
          <div
            className="table-ctx-item"
            onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'cell' }))}
          >
            <span>Cell</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            {tableCtxMenu.activeSubmenu === 'cell' && (
              <div className="table-ctx-submenu" onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'cell' }))}>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleMergeCells(); }}>
                  <TableProperties className="h-3.5 w-3.5 mr-2 opacity-70" />Merge Cells
                </div>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleSplitCell(); }}>
                  Split Cell
                </div>
              </div>
            )}
          </div>

          {/* Row submenu trigger */}
          <div
            className="table-ctx-item"
            onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'row' }))}
          >
            <span>Row</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            {tableCtxMenu.activeSubmenu === 'row' && (
              <div className="table-ctx-submenu" onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'row' }))}>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleAddRowBefore(); }}>
                  <Rows3 className="h-3.5 w-3.5 mr-2 opacity-70" />Insert Row Before
                </div>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleAddRowAfter(); }}>
                  <Rows3 className="h-3.5 w-3.5 mr-2 opacity-70" />Insert Row After
                </div>
                <div className="table-ctx-item table-ctx-item-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteRow(); }}>
                  Delete Row
                </div>
              </div>
            )}
          </div>

          {/* Column submenu trigger */}
          <div
            className="table-ctx-item"
            onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'column' }))}
          >
            <span>Column</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            {tableCtxMenu.activeSubmenu === 'column' && (
              <div className="table-ctx-submenu" onMouseEnter={() => setTableCtxMenu((p) => ({ ...p, activeSubmenu: 'column' }))}>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleAddColumnBefore(); }}>
                  <Columns3 className="h-3.5 w-3.5 mr-2 opacity-70" />Insert Column Before
                </div>
                <div className="table-ctx-item" onClick={(e) => { e.stopPropagation(); handleAddColumnAfter(); }}>
                  <Columns3 className="h-3.5 w-3.5 mr-2 opacity-70" />Insert Column After
                </div>
                <div className="table-ctx-item table-ctx-item-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteColumn(); }}>
                  Delete Column
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="table-ctx-separator" />

          {/* Delete table (direct action) */}
          <div
            className="table-ctx-item table-ctx-item-destructive"
            onClick={(e) => { e.stopPropagation(); handleDeleteTable(); }}
          >
            Delete table
          </div>
        </div>
      )}

      {/* ========== EDITOR CONTENT ========== */}
      <div className="flex-1 overflow-y-auto min-h-0" onContextMenu={handleTableContextMenu}>
        <div className="max-w-4xl mx-auto px-6 md:px-12 lg:px-16 py-8">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ========== STATUS BAR ========== */}
      <div className="border-t border-border/30 px-4 py-1.5 flex items-center gap-4 text-[11px] text-muted-foreground bg-muted/20 shrink-0">
        <span>{stats.words} words</span>
        <span>·</span>
        <span>{stats.readingTime}</span>
        <span>·</span>
        <span>{stats.chars} characters</span>
        <div className="ml-auto hidden sm:flex items-center gap-2">
          {editorMode !== 'editing' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
              {editorMode}
            </Badge>
          )}
          <span className="font-mono">{currentFontFamily ? currentFontFamily.split(',')[0].replace(/['"]+/g, '') : 'Default'}</span>
          {currentFontSize && <span>· {currentFontSize}</span>}
        </div>
      </div>
    </div>
  );
});

// -------------------- Placeholder icon components --------------------
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
