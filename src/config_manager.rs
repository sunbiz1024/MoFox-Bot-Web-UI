use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigField {
    pub name: String,
    pub value: toml::Value,
    pub field_type: String,
    pub comment: Option<String>,
    pub section: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSection {
    pub name: String,
    pub fields: Vec<ConfigField>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigFile {
    pub filename: String,
    pub path: String,
    pub sections: Vec<ConfigSection>,
    pub raw_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    pub name: String,
    pub path: String,
    pub config: ConfigFile,
}

pub struct ConfigManager {
    bot_config_path: PathBuf,
    model_config_path: PathBuf,
    plugins_dir: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Self {
        Self {
            bot_config_path: PathBuf::from("../Bot/config/bot_config.toml"),
            model_config_path: PathBuf::from("../Bot/config/model_config.toml"),
            plugins_dir: PathBuf::from("../Bot/config/plugins"),
        }
    }

    pub async fn get_bot_config(&self) -> Result<ConfigFile> {
        self.parse_config_file(&self.bot_config_path, "bot_config.toml").await
    }

    pub async fn get_model_config(&self) -> Result<ConfigFile> {
        self.parse_config_file(&self.model_config_path, "model_config.toml").await
    }

    pub async fn get_plugin_configs(&self) -> Result<Vec<PluginConfig>> {
        let mut plugins = Vec::new();
        
        if !self.plugins_dir.exists() {
            return Ok(plugins);
        }

        let mut entries = fs::read_dir(&self.plugins_dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let plugin_name = entry.file_name().to_string_lossy().to_string();
                let config_path = entry.path().join("config.toml");
                
                if config_path.exists() {
                    match self.parse_config_file(&config_path, &format!("{}/config.toml", plugin_name)).await {
                        Ok(config) => {
                            plugins.push(PluginConfig {
                                name: plugin_name,
                                path: config_path.to_string_lossy().to_string(),
                                config,
                            });
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse plugin config {}: {}", plugin_name, e);
                        }
                    }
                }
            }
        }

        Ok(plugins)
    }

    pub async fn save_config(&self, file_path: &str, config: &ConfigFile) -> Result<()> {
        let updated_content = self.reconstruct_toml_with_comments(config)?;
        fs::write(file_path, updated_content).await?;
        Ok(())
    }

    async fn parse_config_file(&self, path: &Path, filename: &str) -> Result<ConfigFile> {
        let content = fs::read_to_string(path).await?;
        let parsed: toml::Value = toml::from_str(&content)?;
        
        let sections = self.extract_sections_with_comments(&content, &parsed)?;
        
        Ok(ConfigFile {
            filename: filename.to_string(),
            path: path.to_string_lossy().to_string(),
            sections,
            raw_content: content,
        })
    }

    fn extract_sections_with_comments(&self, content: &str, parsed: &toml::Value) -> Result<Vec<ConfigSection>> {
        let mut sections = Vec::new();
        
        if let toml::Value::Table(table) = parsed {
            for (section_name, section_value) in table {
                let section_comment = self.extract_section_comment(content, section_name);
                let fields = self.extract_fields_from_section(content, section_name, section_value)?;
                
                sections.push(ConfigSection {
                    name: section_name.clone(),
                    fields,
                    comment: section_comment,
                });
            }
        }
        
        Ok(sections)
    }

    fn extract_fields_from_section(&self, content: &str, section_name: &str, section_value: &toml::Value) -> Result<Vec<ConfigField>> {
        let mut fields = Vec::new();
        
        match section_value {
            toml::Value::Table(table) => {
                for (field_name, field_value) in table {
                    let comment = self.extract_field_comment(content, section_name, field_name);
                    let field_type = self.determine_field_type(field_value);
                    
                    fields.push(ConfigField {
                        name: field_name.clone(),
                        value: field_value.clone(),
                        field_type,
                        comment,
                        section: section_name.to_string(),
                    });
                }
            }
            toml::Value::Array(arr) => {
                // 处理数组类型的section (如 [[api_providers]])
                for (index, item) in arr.iter().enumerate() {
                    if let toml::Value::Table(table) = item {
                        for (field_name, field_value) in table {
                            let comment = self.extract_field_comment(content, section_name, field_name);
                            let field_type = self.determine_field_type(field_value);
                            
                            fields.push(ConfigField {
                                name: format!("[{}].{}", index, field_name),
                                value: field_value.clone(),
                                field_type,
                                comment,
                                section: section_name.to_string(),
                            });
                        }
                    }
                }
            }
            _ => {
                // 处理直接值
                let comment = self.extract_field_comment(content, "", section_name);
                let field_type = self.determine_field_type(section_value);
                
                fields.push(ConfigField {
                    name: section_name.to_string(),
                    value: section_value.clone(),
                    field_type,
                    comment,
                    section: "".to_string(),
                });
            }
        }
        
        Ok(fields)
    }

    fn extract_section_comment(&self, content: &str, section_name: &str) -> Option<String> {
        let section_pattern = format!(r"#[^[]*\[{}[^\]]*\]", regex::escape(section_name));
        if let Ok(re) = Regex::new(&section_pattern) {
            if let Some(mat) = re.find(content) {
                let comment_start = content[..mat.start()].rfind('#');
                if let Some(start) = comment_start {
                    let comment_line = content[start..mat.start()].trim();
                    if comment_line.starts_with('#') {
                        return Some(comment_line[1..].trim().to_string());
                    }
                }
            }
        }
        None
    }

    fn extract_field_comment(&self, content: &str, _section_name: &str, field_name: &str) -> Option<String> {
        let lines: Vec<&str> = content.lines().collect();
        let field_pattern = format!(r"^\s*{}\s*=", regex::escape(field_name));
        
        if let Ok(re) = Regex::new(&field_pattern) {
            for (i, line) in lines.iter().enumerate() {
                if re.is_match(line) {
                    // 查找同一行的注释
                    if let Some(comment_pos) = line.find('#') {
                        let comment = line[comment_pos + 1..].trim();
                        if !comment.is_empty() {
                            return Some(comment.to_string());
                        }
                    }
                    
                    // 查找上一行的注释
                    if i > 0 {
                        let prev_line = lines[i - 1].trim();
                        if prev_line.starts_with('#') {
                            return Some(prev_line[1..].trim().to_string());
                        }
                    }
                }
            }
        }
        
        None
    }

    fn determine_field_type(&self, value: &toml::Value) -> String {
        match value {
            toml::Value::String(_) => "string".to_string(),
            toml::Value::Integer(_) => "integer".to_string(),
            toml::Value::Float(_) => "float".to_string(),
            toml::Value::Boolean(_) => "boolean".to_string(),
            toml::Value::Array(_) => "array".to_string(),
            toml::Value::Table(_) => "table".to_string(),
            toml::Value::Datetime(_) => "datetime".to_string(),
        }
    }

    fn reconstruct_toml_with_comments(&self, config: &ConfigFile) -> Result<String> {
        let mut result = String::new();
        
        for section in &config.sections {
            // 添加section注释
            if let Some(comment) = &section.comment {
                result.push_str(&format!("# {}\n", comment));
            }
            
            // 添加section头
            if !section.name.is_empty() {
                if section.name.contains('.') {
                    result.push_str(&format!("[{}]\n", section.name));
                } else {
                    result.push_str(&format!("[{}]\n", section.name));
                }
            }
            
            // 添加字段
            for field in &section.fields {
                if let Some(comment) = &field.comment {
                    result.push_str(&format!("# {}\n", comment));
                }
                
                let value_str = self.value_to_toml_string(&field.value);
                result.push_str(&format!("{} = {}\n", field.name, value_str));
            }
            
            result.push('\n');
        }
        
        Ok(result)
    }

    fn value_to_toml_string(&self, value: &toml::Value) -> String {
        match value {
            toml::Value::String(s) => {
                // 检查是否包含换行符，如果包含则使用三引号
                if s.contains('\n') {
                    format!("\"\"\"{}\"\"\"", s)
                } else {
                    format!("\"{}\"", s)
                }
            },
            toml::Value::Integer(i) => i.to_string(),
            toml::Value::Float(f) => f.to_string(),
            toml::Value::Boolean(b) => b.to_string(),
            toml::Value::Array(arr) => {
                let items: Vec<String> = arr.iter()
                    .map(|v| self.value_to_toml_string(v))
                    .collect();
                format!("[{}]", items.join(", "))
            }
            toml::Value::Table(_) => "{}".to_string(),
            toml::Value::Datetime(dt) => format!("\"{}\"", dt),
        }
    }
}
