-- DataAsset 자기 참조 M:M: 파생 관계 (A가 B를 기반으로 생성됨)
CREATE TABLE "_DataAssetDerivation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DataAssetDerivation_A_fkey" FOREIGN KEY ("A") REFERENCES "DataAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DataAssetDerivation_B_fkey" FOREIGN KEY ("B") REFERENCES "DataAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_DataAssetDerivation_AB_unique" ON "_DataAssetDerivation"("A", "B");
CREATE INDEX "_DataAssetDerivation_B_index" ON "_DataAssetDerivation"("B");
