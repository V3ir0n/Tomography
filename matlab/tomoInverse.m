% Code to retrieve concentration profiles of plumes from measured scans
% InfraVis Volcanic Clouds
% Apr 2024

close all;
clear all;

% user parameters
completenessLimit = 0.9; % completeness value between 0.5 and 1, the larger the better
baricenterLimit = 60; % angle of centre of mass, between 0 and 75
timeDifferenceMin = 15; % difference in time between scans in minutes
plots = 1; % >0 activates plots

%subdirectory = 'turrialba/';
subdirectory = 'sabancaya/';

% additional files
volcanoFile = fopen('volcano_list.txt','r'); % a list of volcanoes' coordinates
dataVol = textscan(volcanoFile,'%s%f%f%f','Headerlines',1);

timeDifference = timeDifferenceMin/(24*60);

% read scans and determine parameters
numberOffset = 5;

directory = dir(strcat(subdirectory,'EvaluationLog*'));
archivo = zeros(length(directory),1);
for i = 1:length(directory)
    file = fopen(strcat(subdirectory,directory(i).name),'r');
    disp(directory(i).name)
    dataAll = fscanf(file,'%c');
    indexScansStart{i} = strfind(dataAll,'<scaninformation>');
    indexScansEnd{i} = strfind(dataAll,'</spectraldata>');
    for j = 1:length(indexScansStart{i})
        data{i,j} = dataAll(indexScansStart{i}(j):indexScansEnd{i}(j)+length('/spectraldata>'));
        indexes{i,j} = strfind(data{i,j},'=');
        date{i,j} = datenum(data{i,j}(indexes{i,j}(1)+1:indexes{i,j}(2)-10),'dd.mm.yyyy');
        startTime{i,j} = 24*(datenum(data{i,j}(indexes{i,j}(2)+1:indexes{i,j}(3)-8),'HH:MM:SS')-datenum('00:00:00','HH:MM:SS'));
        compass{i,j} = str2double(data{i,j}(indexes{i,j}(3)+1:indexes{i,j}(4)-5));
        tilt{i,j} = str2double(data{i,j}(indexes{i,j}(4)+1:indexes{i,j}(5)-4));
        lat{i,j} = str2double(data{i,j}(indexes{i,j}(5)+1:indexes{i,j}(6)-5));
        long{i,j} = str2double(data{i,j}(indexes{i,j}(6)+1:indexes{i,j}(7)-4));
        alt{i,j} = str2double(data{i,j}(indexes{i,j}(7)+1:indexes{i,j}(8)-8));
        volcano{i,j} = data{i,j}(indexes{i,j}(8)+1:indexes{i,j}(9)-8);
        site{i,j} = data{i,j}(indexes{i,j}(9)+1:indexes{i,j}(10)-7);
        observatory{i,j} = data{i,j}(indexes{i,j}(10)+1:indexes{i,j}(11)-10);
        serial{i,j} = data{i,j}(indexes{i,j}(11)+1:indexes{i,j}(12)-13);
        spectrometer{i,j} = data{i,j}(indexes{i,j}(12)+1:indexes{i,j}(13)-8);
        channel{i,j} = str2double(data{i,j}(indexes{i,j}(13)+1:indexes{i,j}(14)-10));
        coneAngle{i,j} = str2double(data{i,j}(indexes{i,j}(14)+1:indexes{i,j}(15)-15));
        interlaceSteps{i,j} = str2double(data{i,j}(indexes{i,j}(15)+1:(indexes{i,j}(16))-13));
        startChannel{i,j} = str2double(data{i,j}(indexes{i,j}(16)+1:indexes{i,j}(17)-15));
        spectrumLength{i,j} = str2double(data{i,j}(indexes{i,j}(17)+1:indexes{i,j}(18)-5));
        flux1{i,j} = str2double(data{i,j}(indexes{i,j}(18)+1:indexes{i,j}(19)-8));
        battery{i,j} = str2double(data{i,j}(indexes{i,j}(19)+1:indexes{i,j}(20)-12));
        temperature{i,j} = str2double(data{i,j}(indexes{i,j}(20)+1:indexes{i,j}(21)-5));
        mode{i,j} = data{i,j}(indexes{i,j}(21)+1:indexes{i,j}(22)-11);
        version{i,j} = data{i,j}(indexes{i,j}(22)+1:indexes{i,j}(23)-17);
        software{i,j} = data{i,j}(indexes{i,j}(23)+1:indexes{i,j}(24)-12);
        compileDate{i,j} = data{i,j}(indexes{i,j}(24)+1:indexes{i,j}(25)-40);

        % readíng flux information
        flux{i,j} = str2double(data{i,j}(indexes{i,j}(25)+1:indexes{i,j}(26)-10));
        windSpeed{i,j} = str2double(data{i,j}(indexes{i,j}(26)+1:indexes{i,j}(27)-14));
        windDir{i,j} = compass{i,j};%str2double(data{i,j}(indexes{i,j}(27)+1:indexes{i,j}(28)-16));
        plumeHeight{i,j} = data{i,j}(indexes{i,j}(28)+1:indexes{i,j}(29)-20);
        plumeCompleteness{i,j} = str2double(data{i,j}(indexes{i,j}(33)+1:indexes{i,j}(34)-12));
        plumeCentre{i,j} = str2double(data{i,j}(indexes{i,j}(34)+1:indexes{i,j}(35)-11));
        plumeEdge1{i,j} = str2double(data{i,j}(indexes{i,j}(35)+1:indexes{i,j}(36)-11));
        plumeEdge2{i,j} = str2double(data{i,j}(indexes{i,j}(36)+1:strfind(data{i,j},'</fluxinfo>')-1));

        % reading scan information
        index2{i,j} = strfind(data{i,j},'spectraldata>');
        numbers{i,j} = data{i,j}((index2{i,j}(1)+15):(index2{i,j}(2)-3));
        temporal0{i,j} = fopen('data.txt','w+');
        fprintf(temporal0{i,j},'%c',numbers{i,j});
        temporal{i,j} = fopen('data.txt');
        Results = textscan(temporal{i,j},'%f%s%s%s%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f%f');
        scanangle = Results{1};
        starttime = Results{2};
        stoptime = Results{3};
        name = Results{4};
        specsaturation = Results{5};
        fitsaturation = Results{6};
        counts_ms = Results{7};
        delta = Results{8};
        chisquare = Results{9};
        exposuretime = Results{10};
        numspec = Results{11};
        columnSO2 = Results{12};
        columnerrorSO2 = Results{13};
        shiftSO2 = Results{14};
        shifterrorSO2 = Results{15};
        squeezeSO2 = Results{16};
        squeezeerrorSO2 = Results{17};
        columnO3 = Results{18};
        columnerrorO3 = Results{19};
        shiftO3 = Results{20};
        shifterrorO3 = Results{21};
        squeezeO3 = Results{22};
        squeezeerrorO3 = Results{23};
        columnRING = Results{24};
        columnerrorRING = Results{25};
        shiftRING = Results{26};
        shifterrorRING = Results{27};
        squeezeRING = Results{28};
        squeezeerrorRING = Results{29};
        isgoodpoint = Results{30};
        offset = Results{31};
        flag = Results{32};

        fclose all;
        delete('data.txt');

        scansAng{i,j} = scanangle;
        scansTime{i,j} = date{i,j}+datenum(starttime,'HH:MM:SS')-datenum(strcat(num2str(year(now)),'-01-01 00:00:00'));
        scansSO2{i,j} = columnSO2;
        scansSO2e{i,j} = columnerrorSO2;
        scansFlag{i,j} = isgoodpoint;

        % convert to VCDs
        pointsAll{i,j} = find(scansAng{i,j}==180);
        indScansAng{i,j} = scansAng{i,j}(pointsAll{i,j}+1:end);
        indScansTime{i,j} = scansTime{i,j}(pointsAll{i,j}+1:end);
        indScansSO2All{i,j} = scansSO2{i,j}(pointsAll{i,j}+1:end);
        indScansSO2eAll{i,j} = scansSO2e{i,j}(pointsAll{i,j}+1:end);
        indScansFlagAll{i,j} = scansFlag{i,j}(pointsAll{i,j}+1:end);

        % calculate offset and transform to SCD in flat geometry
        offsetAll0{i,j} = sort(indScansSO2All{i,j});
        offsetAll{i,j} = mean(offsetAll0{i,j}(1:numberOffset));
        indScansSO2o{i,j} = indScansSO2All{i,j}-offsetAll{i,j};
        indScansSO2AllFinal{i,j} = indScansSO2o{i,j}.*sind(coneAngle{i,j});

        % calculate most important scan properties
        scansTimeFinal(i,j) = indScansTime{i,j}(1);
        scansBaricenter(i,j) = sum(indScansAng{i,j}.*indScansSO2AllFinal{i,j})/sum(indScansSO2AllFinal{i,j});
        scansCompleteness(i,j) = 1 - 0.5*(max(0.2*sum(indScansSO2AllFinal{i,j}(1:5)),0.2*sum(indScansSO2AllFinal{i,j}(end-4:end)))/max(indScansSO2AllFinal{i,j}));
        scansMeanColumn(i,j) = mean(indScansSO2AllFinal{i,j});

    end
end

% filtering
for m = 1:2
    k = 0;
    for n = 1:length(scansBaricenter)
        if and(abs(scansBaricenter(m,n))<baricenterLimit,and(scansCompleteness(m,n)>completenessLimit,max(indScansSO2AllFinal{m,n})>0))
            indScansTimeValid{m,n} = indScansTime{m,n};
            indScansSO2Valid{m,n} = indScansSO2AllFinal{m,n};
            k = k+1;
            indexValid(m,k) = n;
        else
            indScansTimeValid{m,n} = indScansTime{m,n};
            indScansSO2Valid{m,n} = 0.*indScansSO2AllFinal{m,n};
        end
    end
end

% station parameters
stepS1 = mean(diff(scansAng{1,1}(3:end))); % scanning step, deg
fovS1 = stepS1/8; % field of view of the instrument
latS1 = lat{1,1}; % latitude station 1
lonS1 = long{1,1}; % longitude
altS1 = alt{1,1}; % altitude

stepS2 = mean(diff(scansAng{2,1}(3:end))); % scanning step, deg
fovS2 = stepS2/8; % field of view of the instrument
latS2 = lat{2,1}; % latitude station 2
lonS2 = long{2,1};
altS2 = alt{2,1};

% finding the volcano
[diffLatVolFinder,indLatVolFinder] = min(abs(latS1-dataVol{2}));
[diffLonVolFinder,indLonVolFinder] = min(abs(latS1-dataVol{3}));
if indLonVolFinder==indLatVolFinder
    latVol = dataVol{2}(indLatVolFinder);
    lonVol = dataVol{3}(indLatVolFinder);
    altVol = dataVol{4}(indLatVolFinder);
else
    indVolcano = find(strcmp(volcano{1,1},dataVol{1})>0);
    latVol = dataVol{2}(indVolcano);
    lonVol = dataVol{3}(indVolcano);
    altVol = dataVol{4}(indVolcano);
end

% solving the location triangle
[latVolutm, lonVolutm, utmzone] = deg2utm(latVol,lonVol);
[latS1utm, lonS1utm] = deg2utm(latS1,lonS1);
[latS2utm, lonS2utm] = deg2utm(latS2,lonS2);

DX1 = lonS1utm-lonVolutm; % relative position in X of station 1 w.r.t. volcano
DY1 = latS1utm-latVolutm; % relative position in Y of station 1
beta1 = coneAngle{1,1}; % coneangle station 1

DX2 = lonS2utm-lonVolutm; % relative position in X of station 1 w.r.t. volcano
DY2 = latS2utm-latVolutm; % relative position in Y of station 1
beta2 = coneAngle{2,1}; % coneangle station 1
deltaH21 = altS2-altS1; % difference in altitude st. 2 - st. 1

% Geometry of stations and plume direction
compass1 = atand(DX1/DY1); % azimuth of station 1
compass2 = atand(DX2/DY2);

% geometry from above and using plume centre
VS1 = sqrt(DX1^2+DY1^2);
VS2 = sqrt(DX2^2+DY2^2);
S12 = sqrt((DX1-DX2)^2+(DY1-DY2)^2);
angleV = acosd((1/(2*VS1*VS2))*(VS1^2+VS2^2-S12^2));
angleS1 = acosd((1/(2*VS1*S12))*(VS1^2+S12^2-VS2^2));
angleS2 = acosd((1/(2*VS2*S12))*(VS2^2+S12^2-VS1^2));

% pairing scans close in time and making the tomography
k = 0;
valid1 = find(indexValid(1,:)>0);
valid2 = find(indexValid(2,:)>0);
for i = 1:length(indexValid(1,valid1))
    for j = 1:length(indexValid(2,valid2))
        % WHAT DOES THE MIN IN THIS LINE DO?
        [valDiff,indexDiff] = min(abs(indScansTimeValid{1,indexValid(1,valid1(i))}(1)-indScansTimeValid{2,indexValid(2,valid2(j))}(1)));
        if (valDiff<=timeDifference)
            % this is to solve the geometry between the selected pair of
            % scans
            k = k+1;
            alpha1 = indScansAng{1,indexValid(1,valid1(i))}(2:end-1); % scan angles St. 1
            alpha2 = indScansAng{2,indexValid(2,valid2(j))}(2:end-1);
            S1 = indScansSO2Valid{1,indexValid(1,valid1(i))}(2:end-1); % columns St. 1
            S2 = indScansSO2Valid{2,indexValid(2,valid2(j))}(2:end-1);
            plumeCentre1 = scansBaricenter(1,indexValid(1,valid1(i))); % centre of mass St. 1
            plumeCentre2 = scansBaricenter(2,indexValid(2,valid2(j)));

            ax = (tand(abs(plumeCentre2))/tand(abs(plumeCentre1)))*tand(abs(angleV));
            bx = (tand(abs(plumeCentre2))/tand(abs(plumeCentre1)))*VS1 + deltaH21*tand(abs(plumeCentre2))*tand(abs(angleV)) + VS2;
            cx = deltaH21*tand(abs(plumeCentre2))*VS1 - VS2*VS1*tand(abs(angleV));

            S1P = (-bx + sqrt(bx^2-4*ax*cx))/(2*ax);

            S2P = VS2*tand(abs(angleV-atand(S1P/VS1)));
            angleV1 = atand(abs(S1P/VS1));
            angleV2 = atand(abs(S2P/VS2));
            L1 = S12 - VS2*sind(abs(angleV-angleV1))/sind(abs(180-angleS1-angleV1)); % horizontal distance to plume over inter-station line
            L2 = S12 - L1;
            plumeDist1(k) = VS1/cosd(angleV1); % plume length från source until intersection
            plumeDist2(k) = VS2/cosd(angleV2);

            alphaB1 = atand((L1/S1P)*tand(alpha1));
            alphaB2 = atand((L2/S2P)*tand(alpha2));

            SB10 = S1.*(cosd(alpha1)./cosd(alphaB1));
            SB20 = S2.*(cosd(alpha2)./cosd(alphaB2));
            SB1 = SB10*(sum(S1)/sum(SB10));
            SB2 = SB20*(sum(S2)/sum(SB20));

            plumeC1 = sum(SB1.*alphaB1)/sum(SB1);
            plumeC2 = sum(SB2.*alphaB2)/sum(SB2);

            plumeH(k) = mean([L1/tand(abs(plumeC1)),L2/tand(abs(plumeC2))+deltaH21]);

            [valueMax1,posMax1] = max(S1);
            posWidth1 = find((S1/valueMax1)<exp(-1));
            wLeft1 = max(find((posWidth1-posMax1)<0));
            valueLeft1 = posWidth1(wLeft1);
            wRight1 = min(find((posWidth1-posMax1)>0));
            valueRight1 = posWidth1(wRight1);

            [valueMax2,posMax2] = max(S2);
            posWidth2 = find((S2/valueMax2)<exp(-1));
            wLeft2 = max(find((posWidth2-posMax2)<0));
            valueLeft2 = posWidth2(wLeft2);
            wRight2 = min(find((posWidth2-posMax2)>0));
            valueRight2 = posWidth2(wRight2);

            %plumeD = abs(abs(compass1)-abs(angleV1));

            ind1 = find(SB1>max(SB1)/exp(1));
            ind2 = find(SB2>max(SB2)/exp(1));
            Matrix = zeros(2*((length(ind1)-1)+(length(ind2)-1)),(length(ind1)-1)*(length(ind2)-1));
            Cols = zeros(2*((length(ind1)-1)+(length(ind2)-1)),1);



%--------------------------------------------------------------------------------------------------------------
            % here starts the tomographic inversion using the
            % low-third-derivative method.
            for m = 1:length(ind1)-1
                Matrix(m,(m-1)*(length(ind2)-1)+1:(m-1)*(length(ind2)-1)+length(ind2)-1) = 1;
                Cols(m,1) = 0.5*(S1(ind1(m))+S1(ind1(m+1)));
            end

            for m = 1:length(ind2)-1
                for n = 1:(length(ind1)-1)
                    Matrix(m+length(ind1)-1,(n-1)*(length(ind2)-1)+m) = 1;
                end
                Cols(m+length(ind1)-1,1) = 0.5*(S2(ind2(m))+S2(ind2(m+1)));
            end

            for m = 1:length(ind1)-4
                Matrix(m+length(ind1)+length(ind2)-2,m) = -1;
                Matrix(m+length(ind1)+length(ind2)-2,m+1) = 3;
                Matrix(m+length(ind1)+length(ind2)-2,m+2) = -3;
                Matrix(m+length(ind1)+length(ind2)-2,m+3) = 1;
            end

            for m = 1:length(ind2)-4
                Matrix(m+2*length(ind1)+length(ind2)-3,m) = -1;
                Matrix(m+2*length(ind1)+length(ind2)-3+1,m) = 3;
                Matrix(m+2*length(ind1)+length(ind2)-3+2,m) = -3;
                Matrix(m+2*length(ind1)+length(ind2)-3+3,m) = 1;
            end

            Matrix(1,1) = 1;
            Matrix(1,2) = -2;
            Matrix(1,3) = 1;
            Matrix(1,4:end) = 0;
            Matrix(1,1) = 1;
            Matrix(2,1) = -2;
            Matrix(3,1) = 1;
            Matrix(4:end,1) = 0;
            Matrix(end,1) = 1;
            Matrix(end,2) = -2;
            Matrix(end,3) = 1;
            Matrix(end,4:end) = 0;
            Matrix(1,end) = 1;
            Matrix(2,end) = -2;
            Matrix(3,end) = 1;
            Matrix(4:end,end) = 0;

            % the concentration profile is calculated here
            Concentration = Cols\Matrix;

            negatives = find(Concentration<0);
            Concentration(negatives) = 0;

            % here we calculate the position of each concentration point in the X-Y grid
            meanAlpha1 = zeros(length(ind1)-1,1);
            meanAlpha2 = zeros(length(ind2)-1,1);
            PosX = cell(length(meanAlpha1),1);
            PosY = cell(length(meanAlpha2),1);
            for m = 1:length(ind1)-1
                for n = 1:length(ind2)-1
                    meanAlpha1(m,1) = (alphaB1(ind1(m))+alphaB1(ind1(m+1)))/2;
                    meanAlpha2(n,1) = (alphaB2(ind2(n))+alphaB2(ind2(n+1)))/2;
                end
            end
            r = 0;
            PosX = zeros(length(meanAlpha1)*length(meanAlpha2),1);
            PosY = PosX;
            for m = 1:length(ind1)-1
                for n = 1:length(ind2)-1
                    r = r+1;
                    PosX(r) = (S12+deltaH21*tand(abs(meanAlpha2(n)))) / (1+tand(abs(meanAlpha2(n)))/tand(abs(meanAlpha1(m))));
                    PosY(r) = PosX(r)/tand(abs(meanAlpha1(m)));
                end
            end

            % plume parameters
            meanPosX = sum(PosX.*Concentration')/sum(Concentration);
            meanPosY = sum(PosY.*Concentration')/sum(Concentration);
            lonMeanPutm = lonS1utm+(meanPosX/S12).*(lonS2utm-lonS1utm);
            latMeanPutm = latS1utm+(meanPosX/S12).*(latS2utm-latS1utm);
            plumeDirection(k) = atand((lonMeanPutm-lonVolutm)/(latMeanPutm-latVolutm));
            plumeWidth1(k) = plumeH(k)*abs(tand(alpha1(valueRight1))-tand(alpha1(valueLeft1)))*cosd(abs(plumeDirection(k)-compass1));
            plumeWidth2(k) = (plumeH(k)-deltaH21)*abs(tand(alpha2(valueRight2))-tand(alpha2(valueLeft2)))*cosd(plumeDirection(k)-compass1);
            lonPutm = lonS1utm+(PosX./S12).*(lonS2utm-lonS1utm);
            latPutm = latS1utm+(PosX./S12).*(latS2utm-latS1utm);
            [lat, lon] = utm2deg(latPutm, lonPutm, repmat(utmzone, length(latPutm), 1));
            altP = altS1+PosY;
            plumeTime = mean([(indScansTimeValid{1,indexValid(1,valid1(i))}(1)),(indScansTimeValid{2,indexValid(2,valid2(j))}(1))]);

            % results
            resultsFile = strcat(subdirectory,'tomography_',serial{1,1},'_',datestr(indScansTimeValid{1,indexValid(1,valid1(i))}(1),'yyyymmdd_HHMM'),'_',serial{2,1},'_',datestr(indScansTimeValid{2,indexValid(2,valid2(j))}(1),'yyyymmdd_HHMM'),'.csv');
            writematrix([length(ind1)-1, length(ind2)-1], resultsFile);
            writematrix([lon lat altP Concentration'], resultsFile, 'WriteMode','append');
            % resultsSummaryFile = strcat(subdirectory,'summary_',serial{1,1},'_',datestr(indScansTimeValid{1,indexValid(1,valid1(1))}(1),'yyyymmdd_HHMM'),'_',serial{2,1},'_',datestr(indScansTimeValid{2,indexValid(2,valid2(end))}(1),'yyyymmdd_HHMM'),'.csv');
            % writematrix([round(year(plumeTime)) round(month(plumeTime)) round(day(plumeTime)) round(hour(plumeTime)) round(minute(plumeTime)) round(plumeH(k)) round(plumeDirection(k))],resultsSummaryFile,'WriteMode','append');
            % plots
            if plots>0
                figure;
                subplot(121);
                indx = find(Concentration>=max(Concentration)/exp(1));
                scatter(PosX(indx),PosY(indx),100,Concentration(indx),'filled');
                hold on;
                line([0 10*sind(alpha1(ind1(1)))],[0 10*cosd(alpha1(ind1(1)))],'Color','b')
                line([0 10*sind(alpha1(ind1(end)))],[0 10*cosd(alpha1(ind1(end)))],'Color','b')
                line([DX2-DX1 DX2-DX1+10*sind(alpha2(ind2(1)))],[deltaH21 deltaH21+10*cosd(alpha2(ind2(1)))],'Color','r')
                line([DX2-DX1 DX2-DX1+10*sind(alpha2(ind2(end)))],[deltaH21 deltaH21+10*cosd(alpha2(ind2(end)))],'Color','r')
                grid on;
                xlabel('x-distance / [m]');
                ylabel('y-distance / [m]');

                subplot(122);
                plot(Cols);
                hold on
                plot(([Matrix]*[Concentration]')*max([Cols])/max([Matrix]*[Concentration]'));
                legend('measured','retrieved');
                grid on;

                clear ind1;
                clear ind2;
                clear Matrix;
                clear Cols;
            end
        end
    end
end

% plots
if plots>0
    figure;
    for m = 1:2
        for n = 1:length(indScansSO2AllFinal{m})
            subplot(3,1,2*m-1);
            bar(indScansTime{m,n},indScansSO2AllFinal{m,n},'FaceColor','r','EdgeColor','r');
            hold on;
            bar(indScansTimeValid{m,n},indScansSO2Valid{m,n},'FaceColor','b','EdgeColor','b');
            legend('all','valid');
            xlabel('time [yy-mm-dd HH:MM]');
            ylabel('SO_2 column / ppm*m');
            title(['St. ',num2str(m)]);
            grid on;
        end
    end

    subplot(312);
    line([lonVolutm lonS1utm],[latVolutm latS1utm],'Color','k');
    hold on;
    line([lonVolutm lonS2utm],[latVolutm latS2utm],'Color','k');
    line([lonS1utm lonS2utm],[latS1utm latS2utm],'Color','k');
    grid on;
    line([lonS2utm lonS2utm+1e3*cosd(abs(compass2))], [latS2utm latS2utm+1e3*sind(abs(compass2))],'Color','b');
    line([lonS2utm lonS2utm-1e3*cosd(abs(compass2))], [latS2utm latS2utm-1e3*sind(abs(compass2))],'Color','b');
    line([lonS1utm lonS1utm+1e3*cosd(abs(compass1))], [latS1utm latS1utm+1e3*sind(abs(compass1))],'Color','b');
    line([lonS1utm lonS1utm-1e3*cosd(abs(compass1))], [latS1utm latS1utm-1e3*sind(abs(compass1))],'Color','b');
    line([lonVolutm lonVolutm+5e3*sind(plumeDirection(k))],[latVolutm latVolutm+5e3*cosd(plumeDirection(k))],'Color','r');
    title(['Plume height: ',num2str(plumeH(end),'%.1f'),' [m above St. 1]; Plume direction: ',num2str(plumeDirection(end),'%.1f'),' [deg]']);
    text(lonVolutm,latVolutm,'Volcano');
    text(lonS1utm,latS1utm,'St. 1');
    text(lonS2utm,latS2utm,'St. 2');
    xlabel('lon [UTM]');
    ylabel('lat [UTM]');
end

clc;
