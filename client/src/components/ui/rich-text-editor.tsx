import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import { Label } from "@/components/ui/label";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  height?: number;
  preview?: 'edit' | 'live' | 'preview';
  hideToolbar?: boolean;
  required?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder = "Enter your text here...",
  height = 200,
  preview = 'edit',
  hideToolbar = false,
  required = false
}: RichTextEditorProps) {
  const [data, setData] = useState(value);

  const handleChange = (val?: string) => {
    const newValue = val || "";
    setData(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="border rounded-md overflow-hidden">
        <MDEditor
          value={data}
          onChange={handleChange}
          preview={preview}
          height={height}
          hideToolbar={hideToolbar}
          visibleDragbar={false}
          textareaProps={{
            placeholder,
            style: {
              fontSize: 14,
              lineHeight: 1.5,
              fontFamily: 'inherit',
            },
          }}
          previewOptions={{
            rehypePlugins: [[rehypeSanitize]],
          }}
          data-color-mode="light"
        />
      </div>
      {!hideToolbar && (
        <div className="text-xs text-gray-500 mt-1">
          Use markdown formatting: **bold**, *italic*, # headers, - lists, etc.
        </div>
      )}
    </div>
  );
}