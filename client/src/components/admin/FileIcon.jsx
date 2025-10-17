import React from 'react';

const iconMap = {
  folder: "https://cdn-icons-png.flaticon.com/512/12075/12075377.png",
  pdf: "https://cdn-icons-png.flaticon.com/512/337/337946.png",
  doc: "https://cdn-icons-png.flaticon.com/512/337/337932.png",
  docx: "https://cdn-icons-png.flaticon.com/512/337/337932.png",
  xls: "https://cdn-icons-png.flaticon.com/512/337/337958.png",
  xlsx: "https://cdn-icons-png.flaticon.com/512/337/337958.png",
  jpg: "https://cdn-icons-png.flaticon.com/512/337/337940.png",
  jpeg: "https://cdn-icons-png.flaticon.com/512/337/337940.png",
  png: "https://cdn-icons-png.flaticon.com/512/337/337940.png",
  zip: "https://cdn-icons-png.flaticon.com/512/8629/8629976.png",
  rar: "https://cdn-icons-png.flaticon.com/512/8629/8629976.png",
  mp4: "https://cdn-icons-png.flaticon.com/512/8243/8243015.png",
  mov: "https://cdn-icons-png.flaticon.com/512/8243/8243015.png",
  avi: "https://cdn-icons-png.flaticon.com/512/8243/8243015.png",
  mp3: "https://cdn-icons-png.flaticon.com/512/3767/3767196.png",
  wav: "https://cdn-icons-png.flaticon.com/512/3767/3767196.png",
  txt: "https://cdn-icons-png.flaticon.com/512/4248/4248224.png",
  json: "https://cdn-icons-png.flaticon.com/512/11570/11570273.png",
  html: "https://cdn-icons-png.flaticon.com/512/337/337937.png",
  css: "https://cdn-icons-png.flaticon.com/512/8242/8242982.png",
  default: "https://cdn-icons-png.flaticon.com/512/342/342348.png",
  icd: "https://cdn-icons-png.flaticon.com/512/10121/10121902.png",
  sldprt: "https://cdn-icons-png.flaticon.com/512/14421/14421956.png",
  sldasm: "https://cdn-icons-png.flaticon.com/512/14421/14421962.png",
  slddrw: "https://cdn-icons-png.flaticon.com/512/2266/2266786.png",
  dwg: "https://cdn-icons-png.flaticon.com/512/2266/2266786.png",
};

const getIconForFile = (fileType, isFolder = false) => {
  if (isFolder) return iconMap.folder;
  const ext = fileType?.toLowerCase() || '';
  return iconMap[ext] || iconMap.default;
};

const FileIcon = ({ fileType, isFolder = false, altText = "File Icon", className = "", style = {} }) => {
  const iconSrc = getIconForFile(fileType, isFolder);

  return (
    <img
      src={iconSrc}
      alt={altText}
      className={`file-icon-img ${className}`.trim()}
      style={{
        objectFit: 'contain', 
        ...style          
      }}
    />
  );
};

export default React.memo(FileIcon);