import { useMemo } from 'react';
import { Editor, type IAllProps } from '@tinymce/tinymce-react';
import { clsx } from 'clsx';
import { useAdminThemeStore } from '../theme/adminThemeStore';

/** Giữ CDN đồng bộ với `tinymce` trong package.json sau mỗi lần nâng cấp npm. */
const TINYMCE_NPM_VERSION = '8.5.0';

const TINY_SRC = `https://cdn.jsdelivr.net/npm/tinymce@${TINYMCE_NPM_VERSION}/tinymce.min.js`;

type TinyInit = NonNullable<IAllProps['init']>;

export type AdminProductRichTextEditorProps = {
  id: string;
  /** Đội chỉ khi cần remount sau `reset(form)` hoặc tải bản ghi khác — không đổi mỗi ký tự. */
  mountKey: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  /** Chiều cao khởi tạo (px); nội dung có thể `autoresize` trong giới hạn `max_height`. */
  height?: number;
  maxHeight?: number;
  className?: string;
};

export function AdminProductRichTextEditor({
  id,
  mountKey,
  value,
  onChange,
  onBlur,
  height = 280,
  maxHeight = Math.max(height + 200, 480),
  className,
}: AdminProductRichTextEditorProps) {
  const mode = useAdminThemeStore((s) => s.mode);

  const init = useMemo<TinyInit>(
    () => ({
      height,
      max_height: maxHeight,
      menubar: false,
      branding: false,
      promotion: false,
      resize: true,
      skin: mode === 'dark' ? 'oxide-dark' : 'oxide',
      content_css: mode === 'dark' ? 'dark' : 'default',
      plugins: ['autoresize', 'lists', 'link', 'autolink', 'table', 'code', 'fullscreen', 'help', 'wordcount'],
      toolbar:
        'undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright | bullist numlist | link table | removeformat code fullscreen help',
      invalid_elements: 'script',
    }),
    [height, maxHeight, mode]
  );

  return (
    <div
      className={clsx(
        '[&_.tox-tinymce]:min-h-[inherit] [&_.tox-tinymce]:overflow-hidden [&_.tox-tinymce]:rounded-lg [&_.tox-tinymce]:border [&_.tox-tinymce]:border-[var(--bg-border)]',
        className
      )}
      style={{ minHeight: `${height}px` }}
    >
      <Editor
        key={mountKey}
        licenseKey="gpl"
        tinymceScriptSrc={TINY_SRC}
        id={id}
        value={value}
        onEditorChange={(html) => onChange(html)}
        onBlur={() => {
          onBlur?.();
        }}
        init={init}
      />
    </div>
  );
}
