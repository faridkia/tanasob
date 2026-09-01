/**
 * WYSIWYG editor for the admin/trainer rich-text fields (class descriptions,
 * trainer bios), with image upload.
 *
 * This file is imported ONLY through React.lazy, so CKEditor lands in its own
 * chunk and never touches the bundle a member downloads — they can't write
 * rich text at all. That matters here: the editor is heavier than the rest of
 * the app put together, and this is a PWA aimed at mid-range phones.
 *
 * Whatever comes out of here is still sanitised server-side (see
 * common/richtext.py). The editor is a convenience, not a security boundary.
 */

import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  ClassicEditor, Essentials, Paragraph, Bold, Italic, Underline, Strikethrough,
  Heading, Link, List, BlockQuote, Table, TableToolbar,
  Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageUpload,
  Alignment, Undo,
} from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'

import api from './api'

/** Bridges CKEditor's upload contract to our own endpoint, so images land in
 *  /media/editor/ with a verified type instead of as base64 in the HTML. */
class ApiUploadAdapter {
  constructor(loader) { this.loader = loader }

  async upload() {
    const file = await this.loader.file
    const data = new FormData()
    data.append('upload', file)
    const { data: result } = await api.post('/editor/upload/', data)
    return { default: result.url }
  }

  abort() { /* nothing to cancel — axios request is short-lived */ }
}

function UploadAdapterPlugin(editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader) => new ApiUploadAdapter(loader)
}

export default function RichTextEditor({ value, onChange }) {
  return (
    <div className="rich-editor">
      <CKEditor
        editor={ClassicEditor}
        data={value || ''}
        onChange={(_, editor) => onChange(editor.getData())}
        config={{
          // v44+ requires an explicit licence declaration; 'GPL' selects the
          // free open-source tier.
          licenseKey: 'GPL',
          plugins: [
            Essentials, Paragraph, Bold, Italic, Underline, Strikethrough,
            Heading, Link, List, BlockQuote, Table, TableToolbar,
            Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageUpload,
            Alignment, Undo,
          ],
          extraPlugins: [UploadAdapterPlugin],
          toolbar: [
            'undo', 'redo', '|',
            'heading', '|',
            'bold', 'italic', 'underline', 'strikethrough', '|',
            'alignment', 'bulletedList', 'numberedList', '|',
            'link', 'uploadImage', 'insertTable', 'blockQuote',
          ],
          image: {
            toolbar: ['imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'toggleImageCaption', 'imageTextAlternative'],
          },
          table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
          language: { ui: 'en', content: 'fa' },
        }}
      />
    </div>
  )
}
