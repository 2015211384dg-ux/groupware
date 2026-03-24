import React, { useState } from 'react';
import './FileUpload.css';
import { useToast } from './Toast';

function FileUpload({ onFilesSelected, maxFiles = 5, maxSize = 10 }) {
    const toast = useToast();
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        addFiles(files);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    };

    const addFiles = (files) => {
        if (files.length + selectedFiles.length > maxFiles) {
            toast.warning(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
            return;
        }

        const maxSizeBytes = maxSize * 1024 * 1024;
        const validFiles = [];

        for (const file of files) {
            if (file.size > maxSizeBytes) {
                toast.warning(`${file.name}은(는) ${maxSize}MB를 초과합니다.`);
                continue;
            }
            validFiles.push(file);
        }

        const newFiles = [...selectedFiles, ...validFiles];
        setSelectedFiles(newFiles);
        onFilesSelected(newFiles);
    };

    const removeFile = (index) => {
        const newFiles = selectedFiles.filter((_, i) => i !== index);
        setSelectedFiles(newFiles);
        onFilesSelected(newFiles);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': '📄',
            'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊',
            'ppt': '📽️', 'pptx': '📽️',
            'zip': '🗜️', 'rar': '🗜️',
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
            'txt': '📃'
        };
        return iconMap[ext] || '📎';
    };

    return (
        <div className="file-upload-container">
            <div
                className={`file-drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
            >
                <input
                    id="file-input"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
                />
                <div className="drop-zone-content">
                    <span className="drop-zone-icon">📎</span>
                    <p className="drop-zone-text">
                        파일을 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="drop-zone-hint">
                        최대 {maxFiles}개, {maxSize}MB 이하
                    </p>
                </div>
            </div>

            {selectedFiles.length > 0 && (
                <div className="file-list">
                    <h4>첨부 파일 ({selectedFiles.length})</h4>
                    {selectedFiles.map((file, index) => (
                        <div key={index} className="file-item">
                            <span className="file-icon">{getFileIcon(file.name)}</span>
                            <div className="file-info">
                                <p className="file-name">{file.name}</p>
                                <p className="file-size">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                                type="button"
                                className="file-remove-btn"
                                onClick={() => removeFile(index)}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default FileUpload;
