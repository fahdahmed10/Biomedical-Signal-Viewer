import numpy as np
import pandas as pd
from fastapi import UploadFile, File, HTTPException, status
from sklearn.decomposition import PCA
from app.MicroBiome.schemas.schema import ProfilingOutput

class PatientProfile:
    def get_top5(self, df, bacteria_columns):
        X = df[bacteria_columns]
        # Get top 4 species by mean abundance
        top4_names = X.mean(axis=0).nlargest(4).index.tolist()
        top5_df = X[top4_names].copy()
        # Sum everything else into 'others'
        top5_df['others'] = X.drop(columns=top4_names).sum(axis=1)
        
        # Format for frontend: { "SpeciesName": [values_across_time], ... }
        bacteria_data = {col: top5_df[col].tolist() for col in top5_df.columns}
        return bacteria_data, top4_names + ['others']
    
    def get_health_index(self, df, good_bugs, bad_bugs):
        # Filter only bugs present in the uploaded file to avoid KeyErrors
        available_good = [b for b in good_bugs if b in df.columns]
        available_bad = [b for b in bad_bugs if b in df.columns]
        
        sum_good = df[available_good].fillna(0).sum(axis=1)
        sum_bad = df[available_bad].fillna(0).sum(axis=1)
        epsilon = 1e-5 
        healthy_index = np.log10((sum_good + epsilon) / (sum_bad + epsilon))
        return healthy_index.tolist()

    def get_shannon_index(self, X):
        epsilon = 1e-5
        # Assuming X is relative abundance (0-100)
        proportions = X / 100.0
        # Replace 0 with epsilon to avoid log(0)
        H = - (proportions * np.log(proportions + epsilon)).sum(axis=1)
        return H.tolist()

    def get_pca_coordinates(self, df, bacteria_columns):
        X_raw = df[bacteria_columns].values
        pseudocount = 1e-6
        X_pseudo = X_raw + pseudocount      
        X_log = np.log(X_pseudo)
        X_clr = X_log - X_log.mean(axis=1, keepdims=True)
                
        pca_model = PCA(n_components=2)
        pcs = pca_model.fit_transform(X_clr)
        
        return pcs[:, 0].tolist(), pcs[:, 1].tolist()

    def profile(self, df):
        df = df.fillna(df.mean(numeric_only=True))
        df = df.fillna(0.0)
        # 1. Column Identification
        metadata_columns = ['External ID', 'Participant ID', 'week_num']
        clinical_columns = ['diagnosis', 'fecalcal']
        bacteria_columns = [col for col in df.columns if col not in metadata_columns + clinical_columns]
        
        # 2. Compute Metrics
        top5_data, top5_names = self.get_top5(df, bacteria_columns)
        
        good_bugs = ['Faecalibacterium prausnitzii', 'Akkermansia muciniphila', 'Roseburia hominis', 'Bifidobacterium longum', 'Eubacterium rectale']    
        bad_bugs = ['Escherichia coli', 'Clostridioides difficile', 'Fusobacterium nucleatum', 'Klebsiella pneumoniae', 'Ruminococcus gnavus']

        protective_dict = {col: df[col].tolist() for col in good_bugs if col in df.columns}
        opportunistic_dict = {col: df[col].tolist() for col in bad_bugs if col in df.columns}

        h_index = self.get_health_index(df, good_bugs, bad_bugs)
        s_index = self.get_shannon_index(df[bacteria_columns])
        pca_x, pca_y = self.get_pca_coordinates(df, bacteria_columns)

        # 3. Assemble Final Output
        return ProfilingOutput(
            participant_id=str(df['Participant ID'].iloc[0]) if 'Participant ID' in df.columns else "Unknown",
            weeks=df['week_num'].tolist() if 'week_num' in df.columns else list(range(len(df))),
            fecalcal=df['fecalcal'].tolist() if 'fecalcal' in df.columns else [],
            top5_bacteria=top5_data,
            top5_names=top5_names,
            healthy_index=h_index,
            shannon_index=s_index,
            pca_x=pca_x,
            pca_y=pca_y,
            protective_bacteria=protective_dict,       
            opportunistic_bacteria=opportunistic_dict  # 
        )

obj = PatientProfile()

async def GetProfile(file: UploadFile = File(...)):
    if not (file.filename.endswith(".csv") or file.filename.endswith(".tsv")):
        raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE, detail="Only CSV or TSV files allowed")
    
    # Read the file bytes into a pandas DataFrame
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.file)
        else:
            df = pd.read_csv(file.file, sep='\t')
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not parse file")
        
    if df.empty:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    results = obj.profile(df) 
    return results